import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAppStore } from '@/lib/store';
import { DEFAULT_THEME } from '@/lib/themes';
import * as Haptics from 'expo-haptics';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentUser = useAppStore((s) => s.currentUser);
  const signOut = useAppStore((s) => s.signOut);
  const refreshEmailVerification = useAppStore((s) => s.refreshEmailVerification);
  const resendVerification = useAppStore((s) => s.resendVerification);

  const handleCheckVerification = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const isVerified = await refreshEmailVerification();
      if (isVerified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          router.replace('/onboarding');
        }, 50);
      } else {
        setError('Email not verified yet. Please check your inbox and click the verification link.');
      }
    } catch {
      setError('Failed to check verification status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setResendLoading(true);
    setMessage('');
    setError('');

    try {
      const result = await resendVerification();
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMessage('Verification email sent! Check your inbox.');
      } else {
        setError(result.error || 'Failed to send email. Please try again.');
      }
    } catch {
      setError('Failed to send email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setTimeout(() => {
      router.replace('/auth');
    }, 50);
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={[DEFAULT_THEME.gradientStart, DEFAULT_THEME.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      <View
        className="flex-1 px-6 justify-center"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {/* Icon */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)} className="items-center mb-8">
          <View className="w-24 h-24 bg-white/20 rounded-full items-center justify-center mb-6">
            <Mail size={48} color="white" />
          </View>
          <Text className="text-white text-2xl font-bold text-center">
            Verify Your Email
          </Text>
          <Text className="text-white/70 text-base mt-3 text-center px-4">
            We sent a verification link to
          </Text>
          <Text className="text-white font-semibold text-base mt-1">
            {currentUser?.email || 'your email'}
          </Text>
        </Animated.View>

        {/* Instructions */}
        <Animated.View entering={FadeIn.delay(300).duration(400)} className="bg-white/10 rounded-2xl p-5 mb-6">
          <Text className="text-white/90 text-center leading-6">
            Click on the link in the email to verify your account. Once verified, tap the button below to continue.
          </Text>
          <Text className="text-white/70 text-center leading-6 mt-3 text-sm">
            Note: If you have not received an email, be sure to check your junk mail folder in the email you provided.
          </Text>
        </Animated.View>

        {/* Messages */}
        {error ? (
          <View className="bg-red-500/20 rounded-xl p-3 mb-4">
            <Text className="text-red-200 text-center">{error}</Text>
          </View>
        ) : null}
        {message ? (
          <View className="bg-green-500/20 rounded-xl p-3 mb-4">
            <Text className="text-green-200 text-center">{message}</Text>
          </View>
        ) : null}

        {/* Check Verification Button */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Pressable
            onPress={handleCheckVerification}
            disabled={loading}
            className="bg-white rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color={DEFAULT_THEME.primary} />
            ) : (
              <>
                <CheckCircle size={20} color={DEFAULT_THEME.primary} />
                <Text style={{ color: DEFAULT_THEME.primary }} className="font-bold text-lg ml-2">
                  I've Verified My Email
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* Resend Email Button */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <Pressable
            onPress={handleResendEmail}
            disabled={resendLoading}
            className="mt-4 py-3 flex-row items-center justify-center active:opacity-80"
          >
            {resendLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <RefreshCw size={18} color="rgba(255,255,255,0.8)" />
                <Text className="text-white/80 font-medium ml-2">
                  Resend Verification Email
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        {/* Sign Out Button */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <Pressable
            onPress={handleSignOut}
            className="mt-8 py-3 flex-row items-center justify-center active:opacity-80"
          >
            <LogOut size={18} color="rgba(255,255,255,0.6)" />
            <Text className="text-white/60 font-medium ml-2">
              Sign Out
            </Text>
          </Pressable>
        </Animated.View>

        {/* Help Text */}
        <View className="mt-auto">
          <Text className="text-white/40 text-center text-xs">
            Didn't receive the email? Check your spam folder or try resending.
          </Text>
        </View>
      </View>
    </View>
  );
}
