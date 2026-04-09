import React from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { Heart, Users, Star, GraduationCap, CheckCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { UserRole } from '@/lib/types';

interface DonationModalProps {
  visible: boolean;
  onDismiss: () => void;
  onContribute: () => void;
  userRole?: UserRole | null;
}

// Full version (plan cards + pricing) shown only to teachers and instructors (school owners).
// Admins, students, guardians, and pending_admin see the short appreciation message only.
const FULL_VERSION_ROLES: UserRole[] = ['teacher', 'instructor'];

export function DonationModal({ visible, onDismiss, onContribute, userRole = null }: DonationModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const showFull = userRole !== null && FULL_VERSION_ROLES.includes(userRole);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  };

  const handleContribute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContribute();
  };

  const plans = [
    {
      icon: <Star size={18} color="#0d9488" />,
      role: 'Teachers & Owners',
      price: '$9.99',
      period: 'per month',
      description: 'Full school management — members, events, payments, and more. Includes a 2-week free trial.',
    },
    {
      icon: <Users size={18} color="#0d9488" />,
      role: 'Admins',
      price: '$6.99',
      period: 'per month',
      description: 'Added by the Teacher/Owner to help manage school operations.',
    },
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View className="flex-1 justify-center items-center bg-black/70 px-5">
        <Animated.View
          entering={FadeIn.duration(300)}
          className={cn('w-full rounded-3xl overflow-hidden', isDark ? 'bg-gray-900' : 'bg-white')}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.45,
            shadowRadius: 28,
            elevation: 14,
            maxHeight: '88%',
          }}
        >
          {/* Header */}
          <LinearGradient
            colors={['#0f766e', '#0d9488', '#14b8a6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingTop: 36, paddingBottom: 28, paddingHorizontal: 24, alignItems: 'center' }}
          >
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Heart size={36} color="white" fill="white" />
              </View>
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.delay(160).duration(400)}
              style={{ color: 'white', fontSize: 22, fontWeight: '700', textAlign: 'center' }}
            >
              Support HalauHub
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(220).duration(400)}
              style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 }}
            >
              {showFull ? 'Keep the community thriving' : 'Free for students and guardians, always.'}
            </Animated.Text>
          </LinearGradient>

          {/* Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 24 }}
          >
            {/* Core message — shown to all roles */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Text
                className={cn('text-sm leading-6 mb-5', isDark ? 'text-gray-300' : 'text-gray-700')}
              >
                HalauHub is sustained by our teachers and owners who subscribe to premium plans to manage their schools.{'\n\n'}
                {showFull ? (
                  <>
                    Teachers and Owners contribute{' '}
                    <Text className={cn('font-semibold', isDark ? 'text-teal-400' : 'text-teal-700')}>
                      $9.99 per month
                    </Text>
                    {' '}(with a 2-week free trial). Admins are appointed by the Teacher/Owner at{' '}
                    <Text className={cn('font-semibold', isDark ? 'text-teal-400' : 'text-teal-700')}>
                      $6.99 per month
                    </Text>
                    .{'\n\n'}
                  </>
                ) : null}
                Your subscription or donation keeps HalauHub free for students and guardians and funds new features for our community.{' '}
                <Text className={cn('font-semibold', isDark ? 'text-amber-400' : 'text-amber-600')}>
                  Mahalo nui loa
                </Text>{' '}
                for being part of this ʻohana!
              </Text>
            </Animated.View>

            {/* Plan cards — teachers & instructors only */}
            {showFull && (
              <Animated.View entering={FadeInDown.delay(380).duration(400)} className="gap-3 mb-5">
                {plans.map((plan, i) => (
                  <View
                    key={i}
                    className={cn(
                      'rounded-2xl p-4 flex-row items-start gap-3',
                      isDark ? 'bg-gray-800' : 'bg-teal-50'
                    )}
                  >
                    <View
                      className={cn(
                        'w-9 h-9 rounded-xl items-center justify-center mt-0.5',
                        isDark ? 'bg-teal-900/60' : 'bg-teal-100'
                      )}
                    >
                      {plan.icon}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-baseline gap-1.5 mb-0.5">
                        <Text className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                          {plan.role}
                        </Text>
                        <Text className={cn('text-teal-600 font-bold text-sm', isDark && 'text-teal-400')}>
                          {plan.price}
                        </Text>
                        <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {plan.period}
                        </Text>
                      </View>
                      <Text className={cn('text-xs leading-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {plan.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}

            {/* Free for students callout — shown to all */}
            <Animated.View
              entering={FadeInDown.delay(showFull ? 460 : 380).duration(400)}
              className={cn(
                'rounded-xl p-3 mb-6 flex-row items-center gap-2',
                isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
              )}
            >
              <GraduationCap size={18} color={isDark ? '#34d399' : '#059669'} />
              <Text
                className={cn(
                  'flex-1 text-xs leading-4',
                  isDark ? 'text-emerald-400' : 'text-emerald-700'
                )}
              >
                Students &amp; guardians access the app through their school — access is granted by the Teacher or Admin.
              </Text>
              <CheckCircle size={16} color={isDark ? '#34d399' : '#059669'} />
            </Animated.View>

            {/* CTAs */}
            <Animated.View entering={FadeInDown.delay(showFull ? 520 : 440).duration(400)} className="gap-3">
              <Pressable
                onPress={handleContribute}
                className="py-4 rounded-xl items-center active:opacity-80"
                style={{ backgroundColor: '#0d9488' }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                  Learn More / Contribute
                </Text>
              </Pressable>
              <Pressable
                onPress={handleClose}
                className="py-3 rounded-xl items-center active:opacity-60"
                style={{ borderWidth: 1, borderColor: isDark ? '#374151' : '#d1d5db' }}
              >
                <Text style={{ color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '500', fontSize: 15 }}>
                  Maybe Later
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
