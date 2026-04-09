import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import { CreditCard, Send, ChevronRight, X, Shield, AlertCircle } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PromoteAdminModalProps {
  visible: boolean;
  member: { id: string; firstName: string; lastName: string; email: string } | null;
  onClose: () => void;
  onAbsorbCost: (memberId: string) => Promise<void>;
  onDelegatePayment: (memberId: string) => Promise<void>;
}

type LoadingState = 'absorb' | 'delegate' | null;

export function PromoteAdminModal({
  visible,
  member,
  onClose,
  onAbsorbCost,
  onDelegatePayment,
}: PromoteAdminModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<LoadingState>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isLoading = loading !== null;

  const handleAbsorbCost = async () => {
    if (isLoading || !member) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading('absorb');
    setErrorMsg(null);
    try {
      await onAbsorbCost(member.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      console.error('[PromoteAdminModal] absorb cost failed:', msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('Could not absorb cost. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleDelegatePayment = async () => {
    if (isLoading || !member) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading('delegate');
    try {
      await onDelegatePayment(member.id);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErrorMsg(null);
    onClose();
  };

  const fullName = member ? `${member.firstName} ${member.lastName}` : '';

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      {/* Backdrop */}
      <Pressable
        onPress={handleClose}
        className="flex-1 justify-end bg-black/60"
      >
        {/* Sheet — absorb the press so it doesn't bubble to backdrop */}
        <Pressable onPress={() => {}} style={{ paddingBottom: insets.bottom }}>
          <Animated.View
            entering={FadeInUp.duration(320).springify().damping(22).stiffness(180)}
            className={cn(
              'rounded-t-3xl overflow-hidden',
              isDark ? 'bg-gray-950' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -6 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 20,
            }}
          >
            {/* Drag handle */}
            <View className="items-center pt-3 pb-1">
              <View
                className={cn(
                  'w-10 h-1 rounded-full',
                  isDark ? 'bg-gray-700' : 'bg-gray-300'
                )}
              />
            </View>

            {/* Header */}
            <Animated.View
              entering={FadeInDown.delay(60).duration(360)}
              className="px-6 pt-4 pb-5"
            >
              {/* Shield badge row */}
              <View className="flex-row items-center mb-3">
                <View
                  className={cn(
                    'w-9 h-9 rounded-full items-center justify-center mr-3',
                    isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'
                  )}
                >
                  <Shield size={18} color={isDark ? '#818CF8' : '#4F46E5'} />
                </View>
                <Text
                  className={cn(
                    'text-xs font-semibold uppercase tracking-widest',
                    isDark ? 'text-indigo-400' : 'text-indigo-600'
                  )}
                >
                  Admin Promotion
                </Text>
              </View>

              <Text
                className={cn(
                  'text-2xl font-bold leading-tight mb-1',
                  isDark ? 'text-white' : 'text-gray-900'
                )}
              >
                Promote {fullName}
              </Text>
              <Text
                className={cn(
                  'text-sm leading-5',
                  isDark ? 'text-gray-400' : 'text-gray-500'
                )}
              >
                Choose how to handle the admin subscription for{' '}
                <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  {member?.email ?? ''}
                </Text>
              </Text>
            </Animated.View>

            {/* Divider */}
            <View
              className={cn('h-px mx-6 mb-5', isDark ? 'bg-gray-800' : 'bg-gray-100')}
            />

            {/* Option cards */}
            <View className="px-4 gap-3 mb-4">
              {/* Inline error banner */}
              {errorMsg && (
                <View
                  className={cn(
                    'flex-row items-center gap-2 px-4 py-3 rounded-xl',
                    isDark ? 'bg-red-500/15' : 'bg-red-50'
                  )}
                >
                  <AlertCircle size={16} color={isDark ? '#F87171' : '#DC2626'} strokeWidth={2} />
                  <Text
                    className={cn(
                      'flex-1 text-sm font-medium',
                      isDark ? 'text-red-400' : 'text-red-600'
                    )}
                  >
                    {errorMsg}
                  </Text>
                </View>
              )}
              {/* Card 1 — Owner absorbs cost */}
              <Animated.View entering={FadeInDown.delay(120).duration(360)}>
                <Pressable
                  onPress={handleAbsorbCost}
                  disabled={isLoading}
                  style={({ pressed }) => ({
                    opacity: loading === 'delegate' ? 0.45 : pressed ? 0.88 : 1,
                    transform: [{ scale: pressed && !isLoading ? 0.985 : 1 }],
                  })}
                >
                  <View
                    className={cn(
                      'rounded-2xl overflow-hidden border',
                      loading === 'absorb'
                        ? isDark
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : 'border-emerald-400/60 bg-emerald-50/80'
                        : isDark
                        ? 'border-gray-800 bg-gray-900'
                        : 'border-gray-200/80 bg-gray-50'
                    )}
                    style={{
                      borderLeftWidth: loading === 'absorb' ? 3 : 1,
                      borderLeftColor:
                        loading === 'absorb'
                          ? '#10B981'
                          : isDark
                          ? '#1F2937'
                          : '#E5E7EB',
                    }}
                  >
                    <View className="flex-row items-center p-4">
                      {/* Icon container */}
                      <View
                        className={cn(
                          'w-12 h-12 rounded-xl items-center justify-center mr-4 shrink-0',
                          isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                        )}
                      >
                        <CreditCard
                          size={22}
                          color={isDark ? '#34D399' : '#059669'}
                          strokeWidth={1.75}
                        />
                      </View>

                      {/* Text */}
                      <View className="flex-1 mr-3">
                        <View className="flex-row items-center gap-2 mb-0.5">
                          <Text
                            className={cn(
                              'text-base font-semibold',
                              isDark ? 'text-white' : 'text-gray-900'
                            )}
                          >
                            Cover their subscription
                          </Text>
                        </View>
                        <Text
                          className={cn(
                            'text-sm leading-5',
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          )}
                        >
                          Add them as an admin seat on your plan
                        </Text>
                        {/* Price badge */}
                        <View
                          className={cn(
                            'self-start mt-2 px-2.5 py-1 rounded-full',
                            isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'
                          )}
                        >
                          <Text
                            className={cn(
                              'text-xs font-bold',
                              isDark ? 'text-emerald-400' : 'text-emerald-700'
                            )}
                          >
                            $6.99 / mo
                          </Text>
                        </View>
                      </View>

                      {/* Right side: spinner or chevron */}
                      <View className="items-center justify-center w-7">
                        {loading === 'absorb' ? (
                          <ActivityIndicator
                            size="small"
                            color={isDark ? '#34D399' : '#059669'}
                          />
                        ) : (
                          <ChevronRight
                            size={18}
                            color={isDark ? '#4B5563' : '#9CA3AF'}
                            strokeWidth={2.5}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>

              {/* Card 2 — They pay themselves */}
              <Animated.View entering={FadeInDown.delay(190).duration(360)}>
                <Pressable
                  onPress={handleDelegatePayment}
                  disabled={isLoading}
                  style={({ pressed }) => ({
                    opacity: loading === 'absorb' ? 0.45 : pressed ? 0.88 : 1,
                    transform: [{ scale: pressed && !isLoading ? 0.985 : 1 }],
                  })}
                >
                  <View
                    className={cn(
                      'rounded-2xl overflow-hidden border',
                      loading === 'delegate'
                        ? isDark
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-blue-400/60 bg-blue-50/80'
                        : isDark
                        ? 'border-gray-800 bg-gray-900'
                        : 'border-gray-200/80 bg-gray-50'
                    )}
                    style={{
                      borderLeftWidth: loading === 'delegate' ? 3 : 1,
                      borderLeftColor:
                        loading === 'delegate'
                          ? '#3B82F6'
                          : isDark
                          ? '#1F2937'
                          : '#E5E7EB',
                    }}
                  >
                    <View className="flex-row items-center p-4">
                      {/* Icon container */}
                      <View
                        className={cn(
                          'w-12 h-12 rounded-xl items-center justify-center mr-4 shrink-0',
                          isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                        )}
                      >
                        <Send
                          size={20}
                          color={isDark ? '#60A5FA' : '#2563EB'}
                          strokeWidth={1.75}
                        />
                      </View>

                      {/* Text */}
                      <View className="flex-1 mr-3">
                        <Text
                          className={cn(
                            'text-base font-semibold mb-0.5',
                            isDark ? 'text-white' : 'text-gray-900'
                          )}
                        >
                          Invite them to subscribe
                        </Text>
                        <Text
                          className={cn(
                            'text-sm leading-5',
                            isDark ? 'text-gray-400' : 'text-gray-500'
                          )}
                        >
                          They'll get an email invite to set up their own plan
                        </Text>
                        {/* Price badge */}
                        <View
                          className={cn(
                            'self-start mt-2 px-2.5 py-1 rounded-full',
                            isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                          )}
                        >
                          <Text
                            className={cn(
                              'text-xs font-bold',
                              isDark ? 'text-blue-400' : 'text-blue-700'
                            )}
                          >
                            Free for you
                          </Text>
                        </View>
                      </View>

                      {/* Right side: spinner or chevron */}
                      <View className="items-center justify-center w-7">
                        {loading === 'delegate' ? (
                          <ActivityIndicator
                            size="small"
                            color={isDark ? '#60A5FA' : '#2563EB'}
                          />
                        ) : (
                          <ChevronRight
                            size={18}
                            color={isDark ? '#4B5563' : '#9CA3AF'}
                            strokeWidth={2.5}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            </View>

            {/* Fine print */}
            <Animated.View
              entering={FadeInDown.delay(260).duration(360)}
              className="px-6 mb-4"
            >
              <Text
                className={cn(
                  'text-xs text-center leading-4',
                  isDark ? 'text-gray-600' : 'text-gray-400'
                )}
              >
                Admin seats include full management access. You can revoke
                permissions at any time from the Members screen.
              </Text>
            </Animated.View>

            {/* Cancel */}
            <Animated.View entering={FadeIn.delay(300).duration(300)}>
              <Pressable
                onPress={handleClose}
                disabled={isLoading}
                className="items-center py-4 active:opacity-60"
              >
                <View className="flex-row items-center gap-1.5">
                  <X
                    size={14}
                    color={isDark ? '#6B7280' : '#9CA3AF'}
                    strokeWidth={2.5}
                  />
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      isDark ? 'text-gray-500' : 'text-gray-400'
                    )}
                  >
                    Cancel
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

            {/* Extra bottom padding for home indicator */}
            <View style={{ height: insets.bottom > 0 ? 0 : 8 }} />
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
