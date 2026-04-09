import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Building2, Users, ArrowRight, Hash, Clock, LogOut, UserCircle, Baby } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { DEFAULT_THEME, UI_CONSTANTS } from '@/lib/themes';
import { cn } from '@/lib/cn';

type OnboardingStep = 'choice' | 'create' | 'join' | 'join-role' | 'awaiting';
type JoinRole = 'student' | 'guardian';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<OnboardingStep>('choice');
  const [halauName, setHalauName] = useState('');
  const [halauDescription, setHalauDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinRole, setJoinRole] = useState<JoinRole>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createHalau = useAppStore((s) => s.createHalau);
  const joinHalauByCode = useAppStore((s) => s.joinHalauByCode);
  const signOut = useAppStore((s) => s.signOut);

  const handleCreate = async () => {
    if (!halauName.trim()) {
      setError('Please enter a halau name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      createHalau(halauName.trim(), halauDescription.trim() || undefined);
      router.replace('/(tabs)');
    } catch (err) {
      setError('Failed to create halau');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await joinHalauByCode(inviteCode.trim(), joinRole);
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        setError(result.error || 'Failed to join halau');
      }
    } catch (err) {
      setError('Failed to join halau');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutFromChoice = async () => {
    await signOut();
    router.replace('/auth');
  };

  const renderChoice = () => (
    <Animated.View entering={FadeIn.duration(400)} className="flex-1 justify-center">
      <Animated.Text
        entering={FadeInDown.delay(100).duration(600)}
        className="text-white text-4xl font-bold text-center mb-3"
        style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
      >
        Welcome
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(200).duration(600)}
        className="text-white/90 text-lg text-center mb-12 font-medium"
        style={{ textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}
      >
        Let's get you set up with your school
      </Animated.Text>

      <Animated.View entering={FadeInUp.delay(300).duration(600)}>
        <Pressable
          onPress={() => setStep('create')}
          className="bg-white rounded-3xl p-6 mb-4 active:opacity-90"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="w-16 h-16 rounded-2xl items-center justify-center mr-4"
              style={{
                backgroundColor: 'rgba(58, 122, 135, 0.15)',
                shadowColor: '#3A7A87',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Building2 size={32} color="#3A7A87" strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 text-xl font-bold">Create a School</Text>
              <Text className="text-gray-600 text-base mt-1">Start your own school</Text>
            </View>
            <ArrowRight size={26} color="#6B7280" />
          </View>
        </Pressable>

        <Pressable
          onPress={() => { setJoinRole('student'); setStep('join'); }}
          className="bg-white/20 border-2 border-white/40 rounded-3xl p-6 mb-4 active:opacity-90"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="w-16 h-16 bg-white/20 rounded-2xl items-center justify-center mr-4"
              style={{
                shadowColor: '#fff',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Users size={32} color="white" strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">Join a School</Text>
              <Text className="text-white/80 text-base mt-1">I'm joining as a student</Text>
            </View>
            <ArrowRight size={26} color="rgba(255,255,255,0.7)" />
          </View>
        </Pressable>

        <Pressable
          onPress={() => { setJoinRole('guardian'); setStep('join'); }}
          className="bg-white/20 border-2 border-white/40 rounded-3xl p-6 active:opacity-90"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="w-16 h-16 bg-white/20 rounded-2xl items-center justify-center mr-4"
              style={{
                shadowColor: '#fff',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Baby size={32} color="white" strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">Parent/Guardian</Text>
              <Text className="text-white/80 text-base mt-1">I'm signing up my child(ren)</Text>
            </View>
            <ArrowRight size={26} color="rgba(255,255,255,0.7)" />
          </View>
        </Pressable>

        {/* Return to Login */}
        <Pressable
          onPress={handleSignOutFromChoice}
          className="flex-row items-center justify-center py-4 mt-6 active:opacity-70"
        >
          <LogOut size={20} color="rgba(255,255,255,0.8)" />
          <Text className="text-white/90 text-center ml-2 font-medium text-base">
            Return to Login
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  const renderCreate = () => (
    <Animated.View entering={FadeIn.duration(400)} className="flex-1">
      <Pressable onPress={() => { setStep('choice'); setError(''); }} className="mb-6">
        <Text className="text-white/90 font-medium text-base">← Back</Text>
      </Pressable>

      <Text
        className="text-white text-3xl font-bold mb-3"
        style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
      >
        Create Your School
      </Text>
      <Text className="text-white/90 text-base mb-8 font-medium">Set up your school and invite students</Text>

      <View
        className="bg-white/15 border border-white/25 rounded-2xl px-4 py-4 mb-4"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Text className="text-white/80 text-xs uppercase tracking-wider mb-2 font-semibold">School Name *</Text>
        <TextInput
          className="text-white text-lg font-medium"
          placeholder="e.g., Kealoha Dance School"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={halauName}
          onChangeText={setHalauName}
          autoCapitalize="words"
          cursorColor="#FFFFFF"
          selectionColor="rgba(255, 255, 255, 0.4)"
        />
      </View>

      <View
        className="bg-white/15 border border-white/25 rounded-2xl px-4 py-4 mb-6"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Text className="text-white/80 text-xs uppercase tracking-wider mb-2 font-semibold">Description (optional)</Text>
        <TextInput
          className="text-white text-base font-medium"
          placeholder="Tell us about your school..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={halauDescription}
          onChangeText={setHalauDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
          cursorColor="#FFFFFF"
          selectionColor="rgba(255, 255, 255, 0.4)"
        />
      </View>

      {error ? (
        <View className="bg-red-500/30 border border-red-400/50 rounded-xl p-3 mb-4">
          <Text className="text-white text-center font-medium">{error}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleCreate}
        disabled={loading}
        className={cn(
          'bg-white rounded-2xl py-4 active:opacity-80',
          loading && 'opacity-70'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#3A7A87" />
        ) : (
          <Text style={{ color: '#3A7A87' }} className="text-center font-bold text-lg">Create School</Text>
        )}
      </Pressable>
    </Animated.View>
  );

  const renderJoinRole = () => (
    <Animated.View entering={FadeIn.duration(400)} className="flex-1">
      <Pressable onPress={() => { setStep('choice'); setError(''); setJoinRole('student'); }} className="mb-6">
        <Text className="text-white/90 font-medium text-base">← Back</Text>
      </Pressable>

      <Text
        className="text-white text-3xl font-bold mb-3"
        style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
      >
        Join as...
      </Text>
      <Text className="text-white/90 text-base mb-8 font-medium">Select your role at this school</Text>

      <Pressable
        onPress={() => { setJoinRole('student'); setStep('join'); }}
        className={cn(
          'rounded-3xl p-6 mb-4 active:opacity-90',
          joinRole === 'student' ? 'bg-white' : 'bg-white/20 border-2 border-white/40'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: joinRole === 'student' ? 0.3 : 0.25,
          shadowRadius: 12,
          elevation: joinRole === 'student' ? 10 : 8,
        }}
      >
        <View className="flex-row items-center">
          <View
            className={cn(
              'w-16 h-16 rounded-2xl items-center justify-center mr-4',
              joinRole === 'student' ? '' : 'bg-white/20'
            )}
            style={joinRole === 'student' ? { backgroundColor: 'rgba(58, 122, 135, 0.15)' } : undefined}
          >
            <UserCircle size={32} color={joinRole === 'student' ? '#3A7A87' : 'white'} strokeWidth={2.5} />
          </View>
          <View className="flex-1">
            <Text className={cn('text-xl font-bold', joinRole === 'student' ? 'text-gray-900' : 'text-white')}>Student</Text>
            <Text className={cn('text-base mt-1', joinRole === 'student' ? 'text-gray-600' : 'text-white/80')}>
              I'm joining as a student
            </Text>
          </View>
          <ArrowRight size={26} color={joinRole === 'student' ? '#6B7280' : 'rgba(255,255,255,0.7)'} />
        </View>
      </Pressable>

      <Pressable
        onPress={() => { setJoinRole('guardian'); setStep('join'); }}
        className={cn(
          'rounded-3xl p-6 active:opacity-90',
          joinRole === 'guardian' ? 'bg-white' : 'bg-white/20 border-2 border-white/40'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: joinRole === 'guardian' ? 0.3 : 0.25,
          shadowRadius: 12,
          elevation: joinRole === 'guardian' ? 10 : 8,
        }}
      >
        <View className="flex-row items-center">
          <View
            className={cn(
              'w-16 h-16 rounded-2xl items-center justify-center mr-4',
              joinRole === 'guardian' ? '' : 'bg-white/20'
            )}
            style={joinRole === 'guardian' ? { backgroundColor: 'rgba(58, 122, 135, 0.15)' } : undefined}
          >
            <Baby size={32} color={joinRole === 'guardian' ? '#3A7A87' : 'white'} strokeWidth={2.5} />
          </View>
          <View className="flex-1">
            <Text className={cn('text-xl font-bold', joinRole === 'guardian' ? 'text-gray-900' : 'text-white')}>Parent/Guardian</Text>
            <Text className={cn('text-base mt-1', joinRole === 'guardian' ? 'text-gray-600' : 'text-white/80')}>
              I'm signing up my child(ren)
            </Text>
          </View>
          <ArrowRight size={26} color={joinRole === 'guardian' ? '#6B7280' : 'rgba(255,255,255,0.7)'} />
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderJoin = () => {
    return (
      <Animated.View entering={FadeIn.duration(400)} className="flex-1">
        <Pressable onPress={() => { setStep('choice'); setError(''); }} className="mb-6">
          <Text className="text-white/90 font-medium text-base">← Back</Text>
        </Pressable>

        <Text
          className="text-white text-3xl font-bold mb-3"
          style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
        >
          Join as {joinRole === 'guardian' ? 'Parent/Guardian' : 'Student'}
        </Text>
        <Text className="text-white/90 text-base mb-8 font-medium">Enter the invite code from your teacher</Text>

        <View
          className="bg-white/15 border border-white/25 rounded-2xl px-4 py-4 mb-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <View className="flex-row items-center">
            <Hash size={22} color="rgba(255,255,255,0.7)" className="mr-3" />
            <TextInput
              className="flex-1 text-white text-2xl tracking-widest font-bold"
              placeholder="ABCD12"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={6}
              cursorColor="#FFFFFF"
              selectionColor="rgba(255, 255, 255, 0.4)"
            />
          </View>
        </View>

        {error ? (
          <View className="bg-red-500/30 border border-red-400/50 rounded-xl p-3 mb-4">
            <Text className="text-white text-center font-medium">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleJoin}
          disabled={loading}
          className={cn(
            'bg-white rounded-2xl py-4 active:opacity-80',
            loading && 'opacity-70'
          )}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#3A7A87" />
          ) : (
            <Text style={{ color: '#3A7A87' }} className="text-center font-bold text-lg">Join School</Text>
          )}
        </Pressable>

        <View
          className="bg-white/15 border border-white/25 rounded-2xl p-4 mt-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="text-white/90 text-base text-center font-medium">
            {joinRole === 'guardian'
              ? "After joining, you'll be able to add your child(ren) and their class level will be assigned by the teacher."
              : "Your request will be sent to the teacher for approval. You'll be notified once approved."}
          </Text>
        </View>

        {/* Request Code Section */}
        <View className="mt-8">
          <Text className="text-white/80 text-center text-base mb-4 font-medium">
            Don't have an invite code? Ask your teacher for the school's invite code.
          </Text>

          {/* Awaiting Code Option */}
          <Pressable
            onPress={() => setStep('awaiting')}
            className="mt-2 py-3"
          >
            <Text className="text-white/90 text-center text-base underline font-medium">
              I've already requested a code
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderAwaiting = () => {
    const handleSignOut = async () => {
      await signOut();
      router.replace('/auth');
    };

    return (
      <Animated.View entering={FadeIn.duration(400)} className="flex-1 justify-center">
        {/* Waiting Icon with enhanced styling */}
        <View className="items-center mb-8">
          <View
            className="w-28 h-28 bg-white/20 rounded-full items-center justify-center mb-5"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Clock size={56} color="white" strokeWidth={2.5} />
          </View>
          <Text
            className="text-white text-3xl font-bold text-center mb-3"
            style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}
          >
            Awaiting Invite Code
          </Text>
          <Text className="text-white/90 text-lg text-center px-4 font-medium">
            Contact your teacher to get an invite code for their school
          </Text>
        </View>

        {/* Got Code Button */}
        <Pressable
          onPress={() => setStep('join')}
          className="bg-white rounded-2xl py-4 mb-4 active:opacity-80"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          <Text style={{ color: '#3A7A87' }} className="text-center font-bold text-lg">I Have a Code</Text>
        </Pressable>

        {/* Info Box */}
        <View
          className="bg-white/15 border border-white/25 rounded-2xl p-4 mb-6"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Text className="text-white/90 text-base text-center font-medium">
            Once you receive your invite code, tap "I Have a Code" to join your school.
          </Text>
        </View>

        {/* Sign Out / Return to Login */}
        <Pressable
          onPress={handleSignOut}
          className="flex-row items-center justify-center py-3 active:opacity-70"
        >
          <LogOut size={20} color="rgba(255,255,255,0.8)" />
          <Text className="text-white/90 text-center ml-2 font-medium text-base">
            Return to Login
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1">
      {/* Dark to Ocean Mist gradient - starts dark above black, fades to Ocean Mist */}
      <LinearGradient
        colors={['#5A9EAD', '#3A6A75', '#1A2A2F', '#0D1517']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
        showsVerticalScrollIndicator={false}
      >
          {step === 'choice' && renderChoice()}
          {step === 'create' && renderCreate()}
          {step === 'join-role' && renderJoinRole()}
          {step === 'join' && renderJoin()}
          {step === 'awaiting' && renderAwaiting()}
      </KeyboardAwareScrollView>
    </View>
  );
}
