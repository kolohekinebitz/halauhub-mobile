import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { auth } from '@/lib/firebase';
import { acceptAdminInvite, declineAdminInvite } from '@/lib/firebase-firestore';
import type { UserRole } from '@/lib/types';

export default function InviteAcceptScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Freeze params at mount — prevents deep link params from being lost if
  // useLocalSearchParams re-evaluates during auth transitions or re-renders.
  const rawParams = useLocalSearchParams<{
    ownerId: string;
    newAdminId: string;
    schoolId: string;
    ownerName?: string;
    schoolName?: string;
    revertToRole?: string;
  }>();
  const [params] = useState(() => rawParams);

  const { ownerId, newAdminId, schoolId, ownerName, schoolName, revertToRole } = params;

  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshSchoolData = useAppStore((s) => s.refreshSchoolData);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentUid = auth.currentUser?.uid;

  // Validate that the deep link is for the currently logged-in user
  const isForCurrentUser = !newAdminId || currentUid === newAdminId;

  const handleAccept = async () => {
    setError(null);
    if (!ownerId || !newAdminId || !schoolId) {
      setError('Invalid invite link. Please ask the owner to resend the invite.');
      return;
    }
    if (!isForCurrentUser) {
      setError('This invite was sent to a different account. Please sign in with the correct account.');
      return;
    }
    setIsAccepting(true);
    try {
      await acceptAdminInvite(ownerId, newAdminId, schoolId);
      // If the store hasn't loaded a school yet (cold-start deep link), seed the halauId
      // so that refreshSchoolData can actually fetch the member list and update the role.
      if (!currentHalauId && schoolId) {
        useAppStore.setState({ currentHalauId: schoolId });
      }
      await refreshSchoolData();
      setDone('accepted');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setError(null);
    if (!newAdminId) {
      setError('Invalid invite link.');
      return;
    }
    if (!isForCurrentUser) {
      setError('This invite was sent to a different account.');
      return;
    }
    setIsDeclining(true);
    try {
      const role = (revertToRole ?? 'student') as UserRole;
      await declineAdminInvite(newAdminId, role, schoolId);
      await refreshSchoolData();
      setDone('declined');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleGoHome = () => {
    router.replace('/(tabs)' as never);
  };

  const bg = isDark ? '#000000' : '#F9FAFB';
  const card = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#111827';
  const subtext = isDark ? '#9CA3AF' : '#6B7280';
  const border = isDark ? '#2D2D2D' : '#E5E7EB';
  const teal = '#0D9488';
  const errorBg = isDark ? '#2D1B1B' : '#FEF2F2';
  const errorText = isDark ? '#FCA5A5' : '#DC2626';

  // Not logged in — show a gate instead of silently failing or losing params
  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: insets.bottom }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: isDark ? '#0D2E2B' : '#CCFBF1', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={40} color={teal} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: text, textAlign: 'center' }}>
            Sign in to accept
          </Text>
          <Text style={{ fontSize: 15, color: subtext, textAlign: 'center', lineHeight: 22 }}>
            You need to be signed in to accept this admin invitation.
          </Text>
          <Pressable
            onPress={() => router.push('/auth' as never)}
            style={({ pressed }) => ({
              marginTop: 12,
              backgroundColor: teal,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 40,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: insets.bottom }}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          {done === 'accepted' ? (
            <CheckCircle size={64} color={teal} />
          ) : (
            <XCircle size={64} color={subtext} />
          )}
          <Text style={{ fontSize: 22, fontWeight: '700', color: text, textAlign: 'center' }}>
            {done === 'accepted' ? "You're now an admin!" : 'Invitation declined'}
          </Text>
          <Text style={{ fontSize: 15, color: subtext, textAlign: 'center', lineHeight: 22 }}>
            {done === 'accepted'
              ? `Welcome to ${schoolName ?? 'the school'}. You now have admin access.`
              : 'No changes were made to your account.'}
          </Text>
          <Pressable
            onPress={handleGoHome}
            style={({ pressed }) => ({
              marginTop: 12,
              backgroundColor: teal,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 40,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Go to app</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        {/* Icon */}
        <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: isDark ? '#0D2E2B' : '#CCFBF1', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Users size={40} color={teal} />
        </View>

        {/* Heading */}
        <Text style={{ fontSize: 24, fontWeight: '700', color: text, textAlign: 'center', marginBottom: 10 }}>
          Admin Invitation
        </Text>
        <Text style={{ fontSize: 15, color: subtext, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          {ownerName ? `${ownerName} has invited you` : 'You have been invited'} to become an admin of{' '}
          <Text style={{ color: text, fontWeight: '600' }}>{schoolName ?? 'your school'}</Text>.
        </Text>

        {/* Card */}
        <View style={{ width: '100%', backgroundColor: card, borderRadius: 16, borderWidth: 1, borderColor: border, padding: 20, gap: 12, marginBottom: 24 }}>
          <Text style={{ fontSize: 13, color: subtext, fontWeight: '500', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            What this means
          </Text>
          {['Access member management', 'View financials and reports', 'Manage events and attendance', 'Owner covers your subscription cost'].map((item) => (
            <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: teal }} />
              <Text style={{ fontSize: 14, color: text }}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Inline error banner */}
        {error && (
          <View style={{
            width: '100%',
            backgroundColor: errorBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: errorText,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 16,
          }}>
            <AlertCircle size={18} color={errorText} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 14, color: errorText, lineHeight: 20 }}>{error}</Text>
          </View>
        )}

        {/* Buttons */}
        <View style={{ width: '100%', gap: 12 }}>
          <Pressable
            onPress={handleAccept}
            disabled={isAccepting || isDeclining}
            style={({ pressed }) => ({
              backgroundColor: teal,
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              opacity: pressed || isAccepting || isDeclining ? 0.7 : 1,
            })}
          >
            {isAccepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Accept Invitation</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleDecline}
            disabled={isAccepting || isDeclining}
            style={({ pressed }) => ({
              backgroundColor: 'transparent',
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: border,
              opacity: pressed || isAccepting || isDeclining ? 0.5 : 1,
            })}
          >
            {isDeclining ? (
              <ActivityIndicator color={subtext} />
            ) : (
              <Text style={{ color: subtext, fontWeight: '600', fontSize: 16 }}>Decline</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
