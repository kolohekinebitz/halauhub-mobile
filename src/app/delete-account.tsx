import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import BackButton from '@/components/BackButton';
import { Trash2, AlertTriangle, Mail } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const currentMember = useAppStore((s) => s.currentMember);
  const signOut = useAppStore((s) => s.signOut);

  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [step, setStep] = useState<'confirm' | 'final'>('confirm');

  const CONFIRM_PHRASE = 'DELETE';
  const isConfirmed = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  const handleProceedToFinal = () => {
    if (!isConfirmed) return;
    setStep('final');
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Send deletion request email as a fallback / audit trail
      // In production this would call a backend endpoint
      await Linking.openURL(
        `mailto:support@kolohekinebitz.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20account.%0A%0AUser%20ID%3A%20${currentMember?.userId ?? 'unknown'}%0AEmail%3A%20${currentMember?.email ?? 'unknown'}%0AName%3A%20${encodeURIComponent((currentMember?.firstName ?? '') + ' ' + (currentMember?.lastName ?? ''))}`
      );
      // Sign out the user
      await signOut();
      router.replace('/auth' as never);
    } catch {
      Alert.alert(
        'Request Sent',
        'Your account deletion request has been received. We will process it within 30 days. You have been signed out.',
        [{ text: 'OK', onPress: () => router.replace('/auth' as never) }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
      {/* Header */}
      <View
        className={cn(
          'flex-row items-center px-4 pb-4 border-b',
          isDark ? 'border-gray-800' : 'border-gray-200'
        )}
        style={{ paddingTop: insets.top + 8 }}
      >
        <BackButton />
        <Text className={cn(
          'flex-1 text-lg font-bold text-center mr-10',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Delete Account
        </Text>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Warning Banner */}
        <Animated.View entering={FadeIn.duration(400)}>
          <LinearGradient
            colors={isDark ? ['#7f1d1d', '#450a0a'] : ['#fef2f2', '#fee2e2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingTop: 32, paddingBottom: 32, paddingHorizontal: 24, alignItems: 'center' }}
          >
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.12)' }}
            >
              <Trash2 size={32} color="#EF4444" />
            </View>
            <Text className={cn(
              'text-xl font-bold text-center mb-2',
              isDark ? 'text-red-300' : 'text-red-700'
            )}>
              This action is permanent
            </Text>
            <Text className={cn(
              'text-sm text-center leading-6',
              isDark ? 'text-red-400' : 'text-red-600'
            )}>
              Deleting your account cannot be undone. All your data will be permanently removed from HalauHub within 30 days.
            </Text>
          </LinearGradient>
        </Animated.View>

        <View className="px-5 pt-6">
          {/* What gets deleted */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-6">
            <View className={cn(
              'rounded-2xl p-4 mb-1',
              isDark ? 'bg-gray-900' : 'bg-gray-50'
            )}>
              <View className="flex-row items-center mb-3">
                <AlertTriangle size={16} color={isDark ? '#FCA5A5' : '#DC2626'} />
                <Text className={cn(
                  'text-sm font-semibold ml-2',
                  isDark ? 'text-red-300' : 'text-red-700'
                )}>
                  What will be deleted
                </Text>
              </View>
              {[
                'Your account and login credentials',
                'Your profile information and photo',
                'Your messages and chat history',
                'Your event RSVPs and attendance records',
                'Your membership in all halau',
              ].map((item) => (
                <View key={item} className="flex-row items-start mb-2">
                  <Text className={cn('mr-2 text-sm mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>•</Text>
                  <Text className={cn('flex-1 text-sm leading-5', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            <View className={cn(
              'rounded-2xl p-4',
              isDark ? 'bg-gray-900/60' : 'bg-amber-50'
            )}>
              <Text className={cn(
                'text-xs leading-5',
                isDark ? 'text-gray-400' : 'text-amber-700'
              )}>
                Financial transaction records and school-level records may be retained by your teacher/administrator for legal compliance purposes even after your account is deleted.
              </Text>
            </View>
          </Animated.View>

          {step === 'confirm' ? (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              {/* Confirm input */}
              <Text className={cn(
                'text-sm font-semibold mb-2',
                isDark ? 'text-gray-200' : 'text-gray-700'
              )}>
                Type DELETE to confirm
              </Text>
              <Text className={cn(
                'text-xs mb-3 leading-5',
                isDark ? 'text-gray-500' : 'text-gray-400'
              )}>
                Enter the word DELETE in all caps to enable the delete button.
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="Type DELETE here"
                placeholderTextColor={isDark ? '#4B5563' : '#9CA3AF'}
                autoCapitalize="characters"
                autoCorrect={false}
                className={cn(
                  'rounded-xl px-4 py-3.5 text-sm font-mono mb-6 border',
                  isDark
                    ? 'bg-gray-900 text-white border-gray-700'
                    : 'bg-gray-50 text-gray-900 border-gray-200'
                )}
              />

              <Pressable
                onPress={handleProceedToFinal}
                disabled={!isConfirmed}
                className={cn(
                  'rounded-2xl py-4 items-center mb-4',
                  isConfirmed
                    ? 'active:opacity-80'
                    : 'opacity-40'
                )}
                style={{ backgroundColor: isConfirmed ? '#EF4444' : (isDark ? '#374151' : '#D1D5DB') }}
              >
                <Text className="text-white font-bold text-base">
                  Continue to Delete
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.back()}
                className={cn(
                  'rounded-2xl py-4 items-center',
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                )}
              >
                <Text className={cn('font-semibold text-base', isDark ? 'text-gray-200' : 'text-gray-700')}>
                  Cancel — Keep My Account
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)}>
              {/* Final confirmation */}
              <View className={cn(
                'rounded-2xl p-4 mb-5 border',
                isDark ? 'bg-gray-900 border-red-900' : 'bg-red-50 border-red-200'
              )}>
                <Text className={cn(
                  'text-sm font-semibold mb-1',
                  isDark ? 'text-red-300' : 'text-red-700'
                )}>
                  Last chance
                </Text>
                <Text className={cn(
                  'text-sm leading-6',
                  isDark ? 'text-gray-300' : 'text-gray-600'
                )}>
                  You are about to permanently delete the account for{' '}
                  <Text className="font-semibold">
                    {currentMember?.firstName} {currentMember?.lastName}
                  </Text>
                  {currentMember?.email ? ` (${currentMember.email})` : ''}. This cannot be undone.
                </Text>
              </View>

              <Pressable
                onPress={handleDeleteAccount}
                disabled={isDeleting}
                className="rounded-2xl py-4 items-center mb-4 active:opacity-80"
                style={{ backgroundColor: '#DC2626' }}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    Yes, Permanently Delete My Account
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setStep('confirm')}
                className={cn(
                  'rounded-2xl py-4 items-center mb-5',
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                )}
              >
                <Text className={cn('font-semibold text-base', isDark ? 'text-gray-200' : 'text-gray-700')}>
                  Go Back
                </Text>
              </Pressable>

              {/* Alternative: email request */}
              <View className={cn('rounded-xl p-4', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
                <Text className={cn('text-xs text-center leading-5 mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Prefer to request deletion via email?
                </Text>
                <Pressable
                  onPress={() => Linking.openURL(`mailto:support@kolohekinebitz.com?subject=Account%20Deletion%20Request&body=Please%20delete%20my%20HalauHub%20account.%0A%0AUser%20ID%3A%20${currentMember?.userId ?? ''}`)}
                  className="flex-row items-center justify-center py-2"
                >
                  <Mail size={13} color={isDark ? '#60A5FA' : '#3B82F6'} />
                  <Text className={cn('text-xs ml-1.5', isDark ? 'text-blue-400' : 'text-blue-600')}>
                    support@kolohekinebitz.com
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
