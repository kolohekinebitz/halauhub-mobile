import React, { useState, useMemo, useEffect } from 'react';
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
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  ArrowLeft,
  DollarSign,
  FileText,
  ChevronDown,
  Check,
  AlertCircle,
  Search,
  X,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { PaymentMethod } from '@/lib/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
];

export default function RecordPaymentScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { submissionId } = useLocalSearchParams<{ submissionId?: string }>();

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const storeMemberDues = useAppStore((s) => s.memberDues);
  const getMemberDuesByHalau = useAppStore((s) => s.getMemberDuesByHalau);
  const recordDuesPayment = useAppStore((s) => s.recordDuesPayment);
  const confirmPaymentSubmission = useAppStore((s) => s.confirmPaymentSubmission);
  const members = useAppStore((s) => s.members);
  const pendingPaymentSubmissions = useAppStore((s) => s.pendingPaymentSubmissions);

  // Resolve the submission if we came from "Confirm Payment"
  const pendingSubmission = useMemo(() => {
    if (!submissionId) return null;
    return pendingPaymentSubmissions.find((s) => s.id === submissionId) ?? null;
  }, [submissionId, pendingPaymentSubmissions]);

  // State
  const [selectedDueId, setSelectedDueId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [showDuesList, setShowDuesList] = useState(false);
  const [dueSearchQuery, setDueSearchQuery] = useState('');

  // Pre-fill from pending submission on mount
  useEffect(() => {
    if (pendingSubmission) {
      setSelectedDueId(pendingSubmission.memberDueId);
      setAmount(pendingSubmission.amount.toFixed(2));
      setMethod(pendingSubmission.method);
      setInvoiceNumber(pendingSubmission.invoiceNumber ?? '');
      setNotes(pendingSubmission.notes ?? '');
    }
  }, [pendingSubmission?.id]);

  // Get unpaid dues — storeMemberDues in deps ensures list refreshes after any mutation
  const unpaidDues = useMemo(() => {
    if (!currentHalauId) return [];
    return getMemberDuesByHalau(currentHalauId).filter((d) => d.status !== 'paid');
  }, [currentHalauId, getMemberDuesByHalau, storeMemberDues]);

  const selectedDue = useMemo(() => {
    return storeMemberDues.find((d) => d.id === selectedDueId);
  }, [selectedDueId, storeMemberDues]);

  const getMemberName = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  // Filtered due list based on search query (by member name or due name)
  const filteredUnpaidDues = useMemo(() => {
    if (!dueSearchQuery.trim()) return unpaidDues;
    const q = dueSearchQuery.toLowerCase();
    return unpaidDues.filter((due) => {
      const memberName = getMemberName(due.memberId).toLowerCase();
      return memberName.includes(q) || due.name.toLowerCase().includes(q);
    });
  }, [unpaidDues, dueSearchQuery, members]);

  // In submission-confirm mode the due selector is locked
  const isConfirmMode = !!pendingSubmission;

  const handleRecordPayment = () => {
    if (!selectedDueId || !amount) {
      Alert.alert('Error', 'Please select a due and enter an amount');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Integrity check: an admin cannot approve/confirm their own payment submission
    if (isConfirmMode && pendingSubmission && currentMember?.role === 'admin' &&
      pendingSubmission.memberId === currentMember.id) {
      Alert.alert(
        'Action Not Allowed',
        'You cannot approve your own payment. Another admin or teacher must review and confirm payments assigned to you.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      if (isConfirmMode && submissionId) {
        // Confirm the student's pending submission with any admin edits.
        // confirmPaymentSubmission handles creating the transaction and updating amountPaid.
        confirmPaymentSubmission(submissionId, {
          amount: parsedAmount,
          method,
          notes: notes.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
        });
      } else {
        recordDuesPayment(selectedDueId, parsedAmount, method, notes.trim() || undefined, invoiceNumber.trim() || undefined);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', isConfirmMode ? 'Payment confirmed successfully' : 'Payment recorded successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to record payment');
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
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}
          >
            <ArrowLeft size={22} color={isDark ? '#FFFFFF' : '#111827'} />
          </Pressable>

          <Text className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            {isConfirmMode ? 'Confirm Payment' : 'Record Payment'}
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

        {/* Submission context banner */}
        {isConfirmMode && pendingSubmission && (
          <Animated.View entering={FadeIn.duration(300)} className="mb-4">
            <View className={cn('p-4 rounded-xl flex-row items-start', isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200')}>
              <AlertCircle size={18} color="#10B981" style={{ marginTop: 1 }} />
              <View className="flex-1 ml-3">
                <Text className={cn('text-sm font-semibold', isDark ? 'text-emerald-300' : 'text-emerald-700')}>
                  Submitted by {getMemberName(pendingSubmission.memberId)}
                </Text>
                <Text className={cn('text-xs mt-0.5', isDark ? 'text-emerald-400/70' : 'text-emerald-600')}>
                  Review and adjust if needed, then confirm.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Select Due */}
        <Animated.View entering={FadeInUp.delay(100).duration(300)} className="mb-4">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Select Due *
          </Text>
          <Pressable
            onPress={() => {
              if (!isConfirmMode) {
                setShowDuesList(!showDuesList);
                if (!showDuesList) setDueSearchQuery('');
              }
            }}
            className={cn(
              'p-4 rounded-xl flex-row items-center justify-between',
              isDark ? 'bg-gray-900' : 'bg-white',
              isConfirmMode && 'opacity-70'
            )}
          >
            {selectedDue ? (
              <View className="flex-1">
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  {getMemberName(selectedDue.memberId)}
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {selectedDue.name} - ${(selectedDue.amount - selectedDue.amountPaid).toFixed(2)} remaining
                </Text>
              </View>
            ) : (
              <Text className={cn(isDark ? 'text-gray-500' : 'text-gray-400')}>
                Select a due to record payment
              </Text>
            )}
            {!isConfirmMode && <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ transform: [{ rotate: showDuesList ? '180deg' : '0deg' }] }} />}
          </Pressable>

          {showDuesList && !isConfirmMode && (
            <View className={cn('mt-2 rounded-xl overflow-hidden', isDark ? 'bg-gray-900' : 'bg-white')}>
              {/* Search bar inside list */}
              <View className={cn('flex-row items-center px-3 py-2.5 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                <Search size={15} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <TextInput
                  value={dueSearchQuery}
                  onChangeText={setDueSearchQuery}
                  placeholder="Search by member name or due..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  className={cn('flex-1 ml-2 text-sm', isDark ? 'text-white' : 'text-gray-900')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {dueSearchQuery.length > 0 && (
                  <Pressable onPress={() => setDueSearchQuery('')} hitSlop={8}>
                    <X size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  </Pressable>
                )}
              </View>

              {/* Scrollable list — max ~5 items visible */}
              <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
                {filteredUnpaidDues.length === 0 ? (
                  <View className="p-4 items-center">
                    <Text className={cn(isDark ? 'text-gray-400' : 'text-gray-600')}>
                      {dueSearchQuery.trim() ? `No results for "${dueSearchQuery}"` : 'No unpaid dues found'}
                    </Text>
                  </View>
                ) : (
                  filteredUnpaidDues.map((due) => (
                    <Pressable
                      key={due.id}
                      onPress={() => {
                        setSelectedDueId(due.id);
                        setAmount((due.amount - due.amountPaid).toFixed(2));
                        // Auto-populate invoice number from any pending submission for this due
                        const pendingSub = pendingPaymentSubmissions.find(
                          (s) => s.memberDueId === due.id && s.status === 'pending' && s.invoiceNumber
                        );
                        setInvoiceNumber(pendingSub?.invoiceNumber ?? '');
                        setShowDuesList(false);
                        setDueSearchQuery('');
                      }}
                      className={cn(
                        'p-4 flex-row items-center border-b',
                        isDark ? 'border-gray-800' : 'border-gray-100',
                        selectedDueId === due.id && (isDark ? 'bg-gray-800' : 'bg-teal-50')
                      )}
                    >
                      <View className="flex-1">
                        <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                          {getMemberName(due.memberId)}
                        </Text>
                        <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                          {due.name}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={cn('font-bold', due.status === 'overdue' ? 'text-red-500' : 'text-teal-500')}>
                          ${(due.amount - due.amountPaid).toFixed(2)}
                        </Text>
                        <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {due.status}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>

              {filteredUnpaidDues.length > 0 && (
                <View className={cn('px-4 py-2 border-t', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <Text className={cn('text-xs text-center', isDark ? 'text-gray-600' : 'text-gray-400')}>
                    {filteredUnpaidDues.length} due{filteredUnpaidDues.length !== 1 ? 's' : ''} found
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Amount */}
        <Animated.View entering={FadeInUp.delay(150).duration(300)} className="mb-4">
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

        {/* Payment Method */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} className="mb-4">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Payment Method
            {isConfirmMode && (
              <Text className={cn('text-xs font-normal ml-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                {' '}(student selected — change if needed)
              </Text>
            )}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <Pressable
                key={pm.value}
                onPress={() => setMethod(pm.value)}
                className={cn(
                  'px-4 py-3 rounded-xl flex-row items-center',
                  method === pm.value
                    ? 'bg-teal-500'
                    : isDark
                    ? 'bg-gray-900'
                    : 'bg-white'
                )}
              >
                {method === pm.value && (
                  <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text
                  className={cn(
                    'font-medium',
                    method === pm.value
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
        </Animated.View>

        {/* Invoice Number */}
        <Animated.View entering={FadeInUp.delay(225).duration(300)} className="mb-4">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Invoice Number (optional)
          </Text>
          <View className="flex-row items-center">
            <View className={cn('p-4 rounded-l-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
              <FileText size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
            <TextInput
              value={invoiceNumber}
              onChangeText={setInvoiceNumber}
              placeholder="e.g. TXN-12345"
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              autoCapitalize="none"
              className={cn(
                'flex-1 p-4 rounded-r-xl text-base',
                isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
              )}
            />
          </View>
        </Animated.View>

        {/* Notes */}
        <Animated.View entering={FadeInUp.delay(250).duration(300)} className="mb-6">
          <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
            Notes (optional)
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes..."
            multiline
            numberOfLines={3}
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            className={cn(
              'p-4 rounded-xl text-base',
              isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
            )}
            style={{ textAlignVertical: 'top', minHeight: 80 }}
          />
        </Animated.View>

        {/* Submit Button */}
        <Animated.View entering={FadeInUp.delay(300).duration(300)}>
          <Pressable
            onPress={handleRecordPayment}
            className="py-4 rounded-2xl items-center"
            style={{
              backgroundColor: isConfirmMode ? '#10B981' : '#0d9488',
              shadowColor: isConfirmMode ? '#10B981' : '#0d9488',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text className="text-white font-bold text-lg">
              {isConfirmMode ? 'Confirm Payment' : 'Record Payment'}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}
