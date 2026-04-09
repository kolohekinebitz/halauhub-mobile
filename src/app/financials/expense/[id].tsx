import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  User,
  Calendar,
  Tag,
  FileText,
  Check,
  X,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Send,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { PaymentMethod } from '@/lib/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
];

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showDenyModal, setShowDenyModal] = useState(false);
  const [releaseMethod, setReleaseMethod] = useState<PaymentMethod>('cash');
  const [denyReason, setDenyReason] = useState('');

  // Store selectors
  const isKumu = useAppStore((s) => s.isKumu);
  const overdueExpenses = useAppStore((s) => s.overdueExpenses);
  const approveOverdueExpense = useAppStore((s) => s.approveOverdueExpense);
  const denyOverdueExpense = useAppStore((s) => s.denyOverdueExpense);
  const releaseOverdueExpense = useAppStore((s) => s.releaseOverdueExpense);
  const members = useAppStore((s) => s.members);
  const users = useAppStore((s) => s.users);

  const isAdmin = isKumu();

  const expense = useMemo(() => {
    return overdueExpenses.find((e) => e.id === id);
  }, [id, overdueExpenses]);

  const member = useMemo(() => {
    if (!expense) return null;
    return members.find((m) => m.id === expense.memberId);
  }, [expense, members]);

  const requestedByUser = useMemo(() => {
    if (!expense) return null;
    return users.find((u) => u.id === expense.requestedBy);
  }, [expense, users]);

  const approvedByUser = useMemo(() => {
    if (!expense?.approvedBy) return null;
    return users.find((u) => u.id === expense.approvedBy);
  }, [expense, users]);

  if (!expense) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
        <Text className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>Expense not found</Text>
      </View>
    );
  }

  const handleApprove = () => {
    Alert.alert(
      'Approve Expense',
      `Are you sure you want to approve this $${expense.amount.toFixed(2)} expense?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => {
            try {
              approveOverdueExpense(expense.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Alert.alert('Error', 'Failed to approve expense');
            }
          },
        },
      ]
    );
  };

  const handleDeny = () => {
    try {
      denyOverdueExpense(expense.id, denyReason.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDenyModal(false);
      setDenyReason('');
    } catch (error) {
      Alert.alert('Error', 'Failed to deny expense');
    }
  };

  const handleRelease = () => {
    try {
      releaseOverdueExpense(expense.id, releaseMethod);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowReleaseModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to release payment');
    }
  };

  const getStatusColor = () => {
    switch (expense.status) {
      case 'released':
        return 'bg-emerald-500';
      case 'approved':
        return 'bg-blue-500';
      case 'denied':
        return 'bg-red-500';
      default:
        return 'bg-amber-500';
    }
  };

  const getStatusIcon = () => {
    switch (expense.status) {
      case 'released':
        return <CheckCircle size={16} color="#FFFFFF" />;
      case 'approved':
        return <Check size={16} color="#FFFFFF" />;
      case 'denied':
        return <XCircle size={16} color="#FFFFFF" />;
      default:
        return <Clock size={16} color="#FFFFFF" />;
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
            Expense Details
          </Text>

          <View className="w-10" />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 100 }}
      >
        {/* Status Badge */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} className="items-center mb-6">
          <View className={cn('flex-row items-center px-4 py-2 rounded-full', getStatusColor())}>
            {getStatusIcon()}
            <Text className="text-white font-semibold ml-2 capitalize">
              {expense.status.replace('_', ' ')}
            </Text>
          </View>
        </Animated.View>

        {/* Amount Card */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(300)}
          className={cn('p-6 rounded-2xl items-center mb-4', isDark ? 'bg-gray-900' : 'bg-white')}
        >
          <Text className={cn('text-4xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            ${expense.amount.toFixed(2)}
          </Text>
          <Text className={cn('text-lg mt-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
            {expense.description}
          </Text>
        </Animated.View>

        {/* Details */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(300)}
          className={cn('p-4 rounded-2xl mb-4', isDark ? 'bg-gray-900' : 'bg-white')}
        >
          {/* Member */}
          <View className="flex-row items-center mb-4">
            <View className={cn('w-10 h-10 rounded-full items-center justify-center mr-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
              <User size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
            <View className="flex-1">
              <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Requested By
              </Text>
              <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {member ? `${member.firstName} ${member.lastName}` : 'Unknown'}
              </Text>
            </View>
          </View>

          {/* Category */}
          <View className="flex-row items-center mb-4">
            <View className={cn('w-10 h-10 rounded-full items-center justify-center mr-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
              <Tag size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
            <View className="flex-1">
              <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Category
              </Text>
              <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {expense.category}
              </Text>
            </View>
          </View>

          {/* Date */}
          <View className="flex-row items-center mb-4">
            <View className={cn('w-10 h-10 rounded-full items-center justify-center mr-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
              <Calendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
            <View className="flex-1">
              <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Requested On
              </Text>
              <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {new Date(expense.requestedAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {expense.notes && (
            <View className="flex-row items-start">
              <View className={cn('w-10 h-10 rounded-full items-center justify-center mr-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                <FileText size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
              <View className="flex-1">
                <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Notes
                </Text>
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  {expense.notes}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Approval Info */}
        {expense.approvedAt && (
          <Animated.View
            entering={FadeInUp.delay(250).duration(300)}
            className={cn('p-4 rounded-2xl mb-4', isDark ? 'bg-gray-900' : 'bg-white')}
          >
            <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {expense.status === 'denied' ? 'Denied' : 'Approved'} Info
            </Text>
            <Text className={cn(isDark ? 'text-white' : 'text-gray-900')}>
              By: {approvedByUser ? `${approvedByUser.firstName} ${approvedByUser.lastName}` : 'Admin'}
            </Text>
            <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              On: {new Date(expense.approvedAt).toLocaleDateString()}
            </Text>
          </Animated.View>
        )}

        {/* Release Info */}
        {expense.releasedAt && (
          <Animated.View
            entering={FadeInUp.delay(300).duration(300)}
            className={cn('p-4 rounded-2xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-50')}
          >
            <View className="flex-row items-center">
              <CheckCircle size={24} color="#10b981" />
              <View className="ml-3">
                <Text className="text-emerald-500 font-bold">Payment Released</Text>
                <Text className={cn('text-sm', isDark ? 'text-emerald-300' : 'text-emerald-700')}>
                  {new Date(expense.releasedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Action Buttons for Admin */}
      {isAdmin && expense.status === 'pending_approval' && (
        <View
          className={cn('px-4 py-4 border-t', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setShowDenyModal(true)}
              className={cn('flex-1 py-4 rounded-xl items-center flex-row justify-center', isDark ? 'bg-red-500/20' : 'bg-red-50')}
            >
              <X size={20} color="#EF4444" />
              <Text className="text-red-500 font-bold ml-2">Deny</Text>
            </Pressable>
            <Pressable
              onPress={handleApprove}
              className="flex-1 py-4 rounded-xl items-center flex-row justify-center bg-teal-500"
            >
              <Check size={20} color="#FFFFFF" />
              <Text className="text-white font-bold ml-2">Approve</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isAdmin && expense.status === 'approved' && (
        <View
          className={cn('px-4 py-4 border-t', isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={() => setShowReleaseModal(true)}
            className="py-4 rounded-xl items-center flex-row justify-center bg-emerald-500"
          >
            <Send size={20} color="#FFFFFF" />
            <Text className="text-white font-bold ml-2">Release Payment</Text>
          </Pressable>
        </View>
      )}

      {/* Deny Modal */}
      <Modal visible={showDenyModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className={cn('w-full rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}>
            <Text className={cn('text-xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Deny Expense
            </Text>
            <TextInput
              value={denyReason}
              onChangeText={setDenyReason}
              placeholder="Reason for denial (optional)"
              multiline
              numberOfLines={3}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              className={cn(
                'p-4 rounded-xl text-base mb-4',
                isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
              )}
              style={{ textAlignVertical: 'top', minHeight: 80 }}
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDenyModal(false)}
                className={cn('flex-1 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
              >
                <Text className={cn('font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeny}
                className="flex-1 py-3 rounded-xl items-center bg-red-500"
              >
                <Text className="text-white font-semibold">Deny</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Release Modal */}
      <Modal visible={showReleaseModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className={cn('w-full rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}>
            <Text className={cn('text-xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
              Release Payment
            </Text>
            <Text className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Select payment method:
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {PAYMENT_METHODS.map((pm) => (
                <Pressable
                  key={pm.value}
                  onPress={() => setReleaseMethod(pm.value)}
                  className={cn(
                    'px-4 py-3 rounded-xl flex-row items-center',
                    releaseMethod === pm.value
                      ? 'bg-emerald-500'
                      : isDark
                      ? 'bg-gray-800'
                      : 'bg-gray-100'
                  )}
                >
                  {releaseMethod === pm.value && (
                    <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text
                    className={cn(
                      'font-medium',
                      releaseMethod === pm.value
                        ? 'text-white'
                        : isDark
                        ? 'text-gray-300'
                        : 'text-gray-700'
                    )}
                  >
                    {pm.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowReleaseModal(false)}
                className={cn('flex-1 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
              >
                <Text className={cn('font-semibold', isDark ? 'text-gray-300' : 'text-gray-700')}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRelease}
                className="flex-1 py-3 rounded-xl items-center bg-emerald-500"
              >
                <Text className="text-white font-semibold">Release</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
