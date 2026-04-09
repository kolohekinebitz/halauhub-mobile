import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  DollarSign,
  FileText,
  Tag,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const EXPENSE_CATEGORIES = [
  'Reimbursement',
  'Costume Refund',
  'Equipment',
  'Travel',
  'Event Supplies',
  'Other',
];

export default function RequestReimbursementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const createOverdueExpense = useAppStore((s) => s.createOverdueExpense);

  // State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Reimbursement');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!currentHalauId || !currentMember) return;

    if (!amount || !description.trim()) {
      Alert.alert('Error', 'Please fill in amount and description');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      createOverdueExpense({
        halauId: currentHalauId,
        memberId: currentMember.id,
        amount: parsedAmount,
        description: description.trim(),
        category,
        status: 'pending_approval',
        notes: notes.trim() || undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Request Submitted',
        'Your reimbursement request has been submitted for approval.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit request');
    }
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className={cn('px-5 pb-4', isDark ? 'bg-gray-900' : 'bg-white')}
      >
        <View className="flex-row items-center justify-between py-4">
          <BackButton />

          <Text className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Request Reimbursement
          </Text>

          <View className="w-10" />
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ flexGrow: 1, paddingTop: 16, paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Info Banner */}
        <Animated.View
          entering={FadeInUp.delay(50).duration(300)}
          className={cn(
            'p-4 rounded-xl mb-6',
            isDark ? 'bg-purple-500/20' : 'bg-purple-50'
          )}
        >
          <Text className={cn('text-sm', isDark ? 'text-purple-200' : 'text-purple-700')}>
            Submit your expense request and it will be sent to the admins for approval. Once approved, you'll receive payment via your preferred method.
          </Text>
        </Animated.View>

        {/* Amount */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)} className="mb-4">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Amount *
          </Text>
          <View className="flex-row items-center">
            <View className={cn('p-4 rounded-l-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
              <DollarSign size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className={cn(
                'flex-1 p-4 rounded-r-xl text-base',
                isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
              )}
            />
          </View>
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInUp.delay(150).duration(300)} className="mb-4">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Description *
          </Text>
          <View className="flex-row items-center">
            <View className={cn('p-4 rounded-l-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
              <FileText size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this for?"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className={cn(
                'flex-1 p-4 rounded-r-xl text-base',
                isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
              )}
            />
          </View>
        </Animated.View>

        {/* Category */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} className="mb-4">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Category
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                className={cn(
                  'px-4 py-2 rounded-full',
                  category === cat
                    ? 'bg-purple-500'
                    : isDark
                    ? 'bg-gray-900'
                    : 'bg-white'
                )}
              >
                <Text
                  className={cn(
                    'font-medium',
                    category === cat
                      ? 'text-white'
                      : isDark
                      ? 'text-gray-300'
                      : 'text-gray-700'
                  )}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeInUp.delay(250).duration(300)} className="mb-6">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Additional Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any additional details..."
            multiline
            numberOfLines={4}
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            className={cn(
              'p-4 rounded-xl text-base',
              isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            )}
            style={{ textAlignVertical: 'top', minHeight: 100 }}
          />
        </Animated.View>

        {/* Submit Button */}
        <Animated.View entering={FadeInUp.delay(300).duration(300)}>
          <Pressable
            onPress={handleSubmit}
            className="bg-purple-500 py-4 rounded-2xl items-center"
            style={{
              shadowColor: '#8b5cf6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">Submit Request</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}
