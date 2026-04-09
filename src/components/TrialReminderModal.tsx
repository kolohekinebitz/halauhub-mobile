import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { Clock, Sparkles, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { TEACHER_PRICE_FALLBACK } from '@/lib/subscription';

interface TrialReminderModalProps {
  visible: boolean;
  onClose: () => void;
  daysRemaining: number;
}

export default function TrialReminderModal({
  visible,
  onClose,
  daysRemaining,
}: TrialReminderModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    router.push('/paywall');
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-6">
        <Animated.View
          entering={FadeInUp.duration(400).springify()}
          className={cn(
            'w-full rounded-3xl overflow-hidden',
            isDark ? 'bg-gray-900' : 'bg-white'
          )}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.4,
            shadowRadius: 32,
            elevation: 20,
          }}
        >
          {/* Header Gradient */}
          <LinearGradient
            colors={['#f59e0b', '#d97706', '#b45309']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 32, paddingHorizontal: 24, alignItems: 'center' }}
          >
            {/* Close button */}
            <Pressable
              onPress={handleClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 items-center justify-center"
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>

            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-4">
              <Clock size={32} color="#FFFFFF" />
            </View>

            <Text className="text-white text-2xl font-bold text-center">
              Your Trial Ends Tomorrow!
            </Text>
            <Text className="text-amber-100 text-center mt-2">
              Only {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left of your free trial
            </Text>
          </LinearGradient>

          {/* Content */}
          <View className="p-6">
            <Text className={cn('text-center text-base mb-6', isDark ? 'text-gray-300' : 'text-gray-600')}>
              Don't lose access to all the premium features you've been enjoying. Subscribe now to continue managing your halau without interruption.
            </Text>

            {/* Benefits reminder */}
            <View className={cn('rounded-2xl p-4 mb-6', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
              <Text className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                Keep access to:
              </Text>
              {[
                'Up to 50 students (Studio Pro) or unlimited (Enterprise)',
                'Advanced event management',
                'Full video library',
                'Payment tracking & reporting',
              ].map((benefit, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <View className="w-5 h-5 rounded-full bg-teal-500/20 items-center justify-center mr-3">
                    <Sparkles size={12} color="#0d9488" />
                  </View>
                  <Text className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>

            {/* CTA Button */}
            <Pressable
              onPress={handleUpgrade}
              className="rounded-2xl overflow-hidden mb-3"
            >
              <LinearGradient
                colors={['#0d9488', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <Text className="text-white font-bold text-lg">
                  Choose a Plan
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Pricing info */}
            <Text className={cn('text-center text-xs mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Starting at {TEACHER_PRICE_FALLBACK}/month as a School Owner
            </Text>

            <Pressable
              onPress={handleClose}
              className="py-3 items-center"
            >
              <Text className={cn('font-medium', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Remind me later
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
