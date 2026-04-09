import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Clock, CheckCircle, LogOut } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { getFirebaseIdToken } from '@/lib/firebase';

const POLL_INTERVAL_MS = 15_000; // 15 seconds

export default function PendingApprovalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signOut = useAppStore((s) => s.signOut);
  const currentMember = useAppStore((s) => s.currentMember);
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  const firstName = currentMember?.firstName || 'there';

  // Poll the backend every 15 seconds to check if the teacher has approved this member.
  // When status flips to 'approved', the _layout.tsx auth guard will automatically
  // redirect to /(tabs) — no manual navigation needed here.
  useEffect(() => {
    if (!currentHalauId || !currentMember?.id) return;

    const checkApproval = async () => {
      try {
        const backendUrl =
          process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ??
          process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) return;

        const token = await getFirebaseIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        let res: Response;
        try {
          res = await fetch(
            `${backendUrl}/api/user/school/${encodeURIComponent(currentHalauId)}/members`,
            { headers, signal: controller.signal }
          );
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) return;

        const json = (await res.json()) as {
          data: Array<{ id?: string; uid?: string; status?: string }> | null;
        };
        const remoteMembers = json?.data;
        if (!Array.isArray(remoteMembers)) return;

        const myRecord = remoteMembers.find(
          (m) => (m.id ?? m.uid) === currentMember.id
        );

        if (myRecord?.status === 'approved') {
          // Patch the local store so the layout guard re-evaluates
          useAppStore.setState((state) => ({
            currentMember: state.currentMember
              ? { ...state.currentMember, status: 'approved' }
              : null,
            members: state.members.map((m) =>
              m.id === currentMember.id ? { ...m, status: 'approved' } : m
            ),
          }));
          // Stop polling — navigation will be handled by _layout.tsx
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Silent — network errors during polling are non-fatal
      }
    };

    // Run once immediately, then on interval
    void checkApproval();
    intervalRef.current = setInterval(() => { void checkApproval(); }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentHalauId, currentMember?.id]);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#5A9EAD', '#3A6A75', '#1A2A2F', '#0D1517']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          justifyContent: 'center',
        }}
      >
        {/* Icon */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={{ alignItems: 'center', marginBottom: 36 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            <Clock size={44} color="white" strokeWidth={1.5} />
          </View>
        </Animated.View>

        {/* Heading */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: '700',
              textAlign: 'center',
              letterSpacing: -0.5,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            Welcome, {firstName}!
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 16,
              textAlign: 'center',
              marginTop: 8,
              lineHeight: 24,
              fontWeight: '500',
            }}
          >
            Your request to join has been received.
          </Text>
        </Animated.View>

        {/* Card */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(600)}
          style={{
            backgroundColor: 'rgba(255,255,255,0.12)',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.2)',
            marginBottom: 32,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 }}>
            <CheckCircle size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginTop: 2, marginRight: 12 }} />
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', flex: 1, lineHeight: 22 }}>
              Your teacher has been notified and will review your account shortly.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <CheckCircle size={20} color="rgba(255,255,255,0.9)" strokeWidth={2} style={{ marginTop: 2, marginRight: 12 }} />
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '500', flex: 1, lineHeight: 22 }}>
              Once approved, you'll have full access to HalauHub.
            </Text>
          </View>
        </Animated.View>

        {/* Hint */}
        <Animated.View entering={FadeInUp.delay(400).duration(600)} style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            This page checks automatically. You'll be taken in as soon as your teacher approves you.
          </Text>
        </Animated.View>

        {/* Sign out */}
        <Animated.View entering={FadeInUp.delay(500).duration(600)}>
          <Pressable
            onPress={handleSignOut}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <LogOut size={18} color="rgba(255,255,255,0.7)" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '600' }}>
              Sign Out
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
