import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { Gift, Check, Calendar, Sparkles, Bell } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { TEACHER_PRICE_FALLBACK } from '@/lib/subscription';

interface TrialStartModalProps {
  visible: boolean;
  onAcknowledge: () => void;
}

export function TrialStartModal({ visible, onAcknowledge }: TrialStartModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const features = [
    'Manage up to 50 students',
    'Create and manage events',
    'Payment tracking',
    'Video library access',
    'Team chat',
    'Digital waivers',
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View className="flex-1 justify-center items-center bg-black/70 px-6">
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
          {/* Header with pastel red/pink gradient */}
          <View
            style={{ backgroundColor: '#FFB3BA' }}
            className="pt-8 pb-6 px-6 items-center"
          >
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View
                className="w-20 h-20 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(127,29,29,0.15)' }}
              >
                <Gift size={40} color="#7F1D1D" />
              </View>
            </Animated.View>
            <Animated.Text
              entering={FadeInDown.delay(200).duration(400)}
              style={{ color: '#7F1D1D', fontSize: 22, fontWeight: '700', textAlign: 'center' }}
            >
              Welcome to Your Free Trial!
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(300).duration(400)}
              style={{ color: '#991B1B', textAlign: 'center', marginTop: 6, fontSize: 14 }}
            >
              Your 2-week free trial starts today
            </Animated.Text>
          </View>

          {/* Content */}
          <View className="p-6">
            {/* Trial info box */}
            <Animated.View
              entering={FadeInDown.delay(400).duration(400)}
              style={{
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                backgroundColor: isDark ? 'rgba(255,179,186,0.12)' : '#FFE4E6',
              }}
            >
              <View className="flex-row items-center mb-3">
                <Calendar size={20} color="#991B1B" />
                <Text
                  style={{ color: isDark ? '#FFB3BA' : '#7F1D1D', fontWeight: '600', marginLeft: 8 }}
                >
                  2 Weeks of Full Access
                </Text>
              </View>
              <Text
                style={{ fontSize: 14, lineHeight: 20, color: isDark ? '#FECDD3' : '#9F1239' }}
              >
                You have a 2-week free trial. No credit card required.
              </Text>
            </Animated.View>

            {/* 3-day reminder note */}
            <Animated.View
              entering={FadeInDown.delay(480).duration(400)}
              style={{
                borderRadius: 12,
                padding: 12,
                marginBottom: 20,
                backgroundColor: isDark ? 'rgba(255,153,153,0.1)' : '#FFF1F2',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Bell size={16} color="#BE123C" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 13, flex: 1, color: isDark ? '#FDA4AF' : '#9F1239' }}>
                You'll receive a reminder with 3 days remaining.
              </Text>
            </Animated.View>

            {/* Features list */}
            <Animated.View entering={FadeInDown.delay(540).duration(400)}>
              <View className="flex-row items-center mb-3">
                <Sparkles size={18} color="#991B1B" />
                <Text
                  style={{ fontWeight: '600', marginLeft: 8, color: isDark ? '#FFB3BA' : '#7F1D1D' }}
                >
                  What's included:
                </Text>
              </View>
              <View className="gap-2 mb-5">
                {features.map((feature, index) => (
                  <View key={index} className="flex-row items-center">
                    <Check size={16} color="#BE123C" />
                    <Text
                      style={{ marginLeft: 8, fontSize: 14, color: isDark ? '#FECDD3' : '#881337' }}
                    >
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Subscribe reminder */}
            <Animated.View
              entering={FadeInDown.delay(640).duration(400)}
              style={{
                borderRadius: 12,
                padding: 12,
                marginBottom: 24,
                backgroundColor: isDark ? 'rgba(255,179,186,0.08)' : '#FFE4E6',
              }}
            >
              <Text
                style={{ fontSize: 13, textAlign: 'center', color: isDark ? '#FDA4AF' : '#9F1239' }}
              >
                Subscribe as a School Owner ({TEACHER_PRICE_FALLBACK}/mo) to continue after your trial.
              </Text>
            </Animated.View>

            {/* Acknowledge button */}
            <Animated.View entering={FadeInDown.delay(720).duration(400)}>
              <Pressable
                onPress={onAcknowledge}
                style={{ backgroundColor: '#BE123C', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
                  Start My Free Trial
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

