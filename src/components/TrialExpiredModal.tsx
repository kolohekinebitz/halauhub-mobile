import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { Clock, UserCog, GraduationCap } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TEACHER_PRICE_FALLBACK, ADMIN_PRICE_FALLBACK } from '@/lib/subscription';
import { useAppStore } from '@/lib/store';

interface TrialExpiredModalProps {
  visible: boolean;
}

export default function TrialExpiredModal({ visible }: TrialExpiredModalProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const signOut = useAppStore((s) => s.signOut);

  const handleSubscribe = () => {
    router.push('/paywall');
  };

  const handleSignOut = async () => {
    // Let _layout.tsx's auth-state effect handle the redirect to /auth.
    // Calling router.replace here races with _layout navigation and can
    // cause "navigate before mounting" warnings or a double-replace.
    await signOut();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center bg-black/80 px-6">
        <Animated.View
          entering={FadeIn.duration(300)}
          className={cn('w-full rounded-3xl overflow-hidden', isDark ? 'bg-gray-900' : 'bg-white')}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          {/* Header */}
          <View className="bg-teal-600 pt-8 pb-6 px-6 items-center">
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center mb-4">
                <Clock size={40} color="white" />
              </View>
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(200).duration(400)}
              className="text-white text-2xl font-bold text-center"
            >
              Your Free Trial Has Ended
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(300).duration(400)}
              className="text-white/80 text-center mt-2"
            >
              Subscribe to continue managing your school
            </Animated.Text>
          </View>

          {/* Content */}
          <View className="p-6">
            {/* Info */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(400)}
              className={cn('rounded-2xl p-4 mb-5', isDark ? 'bg-gray-800' : 'bg-gray-100')}
            >
              <Text className={cn('text-center leading-6', isDark ? 'text-gray-300' : 'text-gray-700')}>
                Your 2-week free trial has ended. Choose a plan to continue accessing all features and managing your students.
              </Text>
            </Animated.View>

            {/* Plan options */}
            <Animated.View entering={FadeInDown.delay(500).duration(400)} className="mb-5">
              <Text className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                Choose your plan:
              </Text>

              {/* Teacher / Owner plan */}
              <View className={cn('rounded-xl p-4 mb-3 border-2 border-teal-500', isDark ? 'bg-teal-500/10' : 'bg-teal-50')}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-teal-500/20 items-center justify-center mr-3">
                      <GraduationCap size={20} color="#0d9488" />
                    </View>
                    <View>
                      <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                        School Owner
                      </Text>
                      <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        Teachers &amp; instructors
                      </Text>
                    </View>
                  </View>
                  <Text className={cn('font-bold text-lg', isDark ? 'text-teal-400' : 'text-teal-600')}>
                    {TEACHER_PRICE_FALLBACK}/mo
                  </Text>
                </View>
              </View>

              {/* Admin plan */}
              <View className={cn('rounded-xl p-4 border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-gray-500/20 items-center justify-center mr-3">
                      <UserCog size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                    </View>
                    <View>
                      <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                        School Admin
                      </Text>
                      <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        Designated by your school owner
                      </Text>
                    </View>
                  </View>
                  <Text className={cn('font-bold text-lg', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {ADMIN_PRICE_FALLBACK}/mo
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Subscribe button */}
            <Animated.View entering={FadeInDown.delay(600).duration(400)}>
              <Pressable
                onPress={handleSubscribe}
                className="bg-teal-600 py-4 rounded-xl items-center active:opacity-80"
              >
                <Text className="text-white font-bold text-base">
                  Choose a Plan
                </Text>
              </Pressable>
            </Animated.View>

            {/* Note */}
            <Animated.View entering={FadeInDown.delay(700).duration(400)}>
              <Text className={cn('text-center text-xs mt-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Students &amp; guardians always have full access for free
              </Text>
            </Animated.View>

            {/* Sign out link */}
            <Animated.View entering={FadeInDown.delay(800).duration(400)} className="items-center mt-3">
              <Pressable onPress={handleSignOut} className="py-2 px-4">
                <Text className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  Sign in with a different account
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
