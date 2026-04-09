import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import {
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  User,
  UserCheck,
  Repeat,
  FileText,
  Receipt,
  Trash2,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { PaymentMethod, FinancialTransaction } from '@/lib/types';

const PAYMENT_METHODS: Record<PaymentMethod, { label: string; color: string }> = {
  venmo: { label: 'Venmo', color: '#008CFF' },
  zelle: { label: 'Zelle', color: '#6D1ED4' },
  cash: { label: 'Cash', color: '#10B981' },
  check: { label: 'Check', color: '#F59E0B' },
};

export default function AdminDueDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  const memberDues = useAppStore((s) => s.memberDues);
  const members = useAppStore((s) => s.members);
  const financialTransactions = useAppStore((s) => s.financialTransactions);
  const pendingPaymentSubmissions = useAppStore((s) => s.pendingPaymentSubmissions);
  const deleteMemberDue = useAppStore((s) => s.deleteMemberDue);
  const currentMember = useAppStore((s) => s.currentMember);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;
  const isAdminOrTeacher = currentMember?.role === 'admin' || currentMember?.role === 'teacher';

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Find the specific due
  const due = useMemo(() => {
    return memberDues.find((d) => d.id === id);
  }, [memberDues, id]);

  // Get member info
  const member = useMemo(() => {
    if (!due) return null;
    return members.find((m) => m.id === due.memberId);
  }, [due, members]);

  // Get who created this due
  const createdByMember = useMemo(() => {
    if (!due) return null;
    return members.find((m) => m.userId === due.createdBy || m.id === due.createdBy);
  }, [due, members]);

  // Get all transactions related to this due
  const relatedTransactions = useMemo(() => {
    if (!id) return [];
    return financialTransactions.filter((t: FinancialTransaction) => t.reference === id);
  }, [financialTransactions, id]);

  // Get pending payment submissions for this due
  const pendingSubmissions = useMemo(() => {
    if (!id) return [];
    return pendingPaymentSubmissions.filter((s) => s.memberDueId === id);
  }, [pendingPaymentSubmissions, id]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'bg-emerald-500/15', text: 'text-emerald-600', color: '#10B981' };
      case 'partial':
        return { bg: 'bg-amber-500/15', text: 'text-amber-600', color: '#F59E0B' };
      case 'overdue':
        return { bg: 'bg-red-500/15', text: 'text-red-500', color: '#EF4444' };
      case 'approved':
        return { bg: 'bg-blue-500/15', text: 'text-blue-600', color: '#3B82F6' };
      default:
        return { bg: isDark ? 'bg-slate-800' : 'bg-slate-100', text: isDark ? 'text-slate-400' : 'text-slate-500', color: '#64748B' };
    }
  };

  const getMemberName = (memberId: string) => {
    const m = members.find((mem) => mem.id === memberId || mem.userId === memberId);
    return m ? `${m.firstName} ${m.lastName}` : 'Unknown';
  };

  const handleRemovePayment = () => {
    if (!due || !id) return;

    const memberName = member ? `${member.firstName} ${member.lastName}` : 'this member';
    const hasPayments = due.amountPaid > 0;

    Alert.alert(
      'Remove Payment',
      hasPayments
        ? `This payment has ${due.amountPaid > 0 ? `$${due.amountPaid.toFixed(2)} already paid` : 'payments recorded'}. Are you sure you want to remove this payment from ${memberName}? This will remove the payment record from their account.`
        : `Are you sure you want to remove this payment from ${memberName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            try {
              deleteMemberDue(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove payment');
            }
          },
        },
      ]
    );
  };

  if (!due) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-slate-50')}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text className={cn('text-lg', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Due not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 rounded-xl"
          style={{ backgroundColor: theme.primary }}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusStyle = getStatusColor(due.status);
  const remainingAmount = due.amount - due.amountPaid;
  const progressPercent = Math.min((due.amountPaid / due.amount) * 100, 100);

  const cardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 6,
    elevation: isDark ? 6 : 5,
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-slate-50')}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ paddingTop: insets.top }}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingBottom: 32 }}
        >
          {/* Top Bar */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <BackButton color="#FFFFFF" />

            <Text className="text-white text-lg font-semibold">Due Details</Text>

            <View className="w-10" />
          </View>

          {/* Amount Display */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center px-5">
            <Text className="text-white/70 text-sm mb-1">
              {due.status === 'paid' ? 'Paid' : 'Amount Due'}
            </Text>
            <Text className="text-white text-4xl font-bold">
              {due.status === 'paid' ? formatCurrency(due.amount) : formatCurrency(remainingAmount)}
            </Text>
            {due.amountPaid > 0 && due.status !== 'paid' && (
              <Text className="text-white/60 text-sm mt-1">
                {formatCurrency(due.amountPaid)} paid of {formatCurrency(due.amount)} total
              </Text>
            )}
          </Animated.View>
        </LinearGradient>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Member & Status Card */}
        <View className="px-5 -mt-4">
          <Animated.View
            entering={FadeInUp.delay(150).duration(400)}
            className={cn('rounded-2xl p-5 border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
            style={cardShadow}
          >
            {/* Member Info */}
            <View className="flex-row items-center mb-4">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${theme.primary}20` }}
              >
                <User size={24} color={theme.primary} />
              </View>
              <View className="flex-1">
                <Text className={cn('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  Assigned To
                </Text>
                <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                  {member ? `${member.firstName} ${member.lastName}` : 'Unknown Member'}
                </Text>
              </View>
              <View className={cn('px-3 py-1.5 rounded-lg', statusStyle.bg)}>
                <Text className={cn('text-xs font-semibold uppercase', statusStyle.text)}>
                  {due.status}
                </Text>
              </View>
            </View>

            {/* Title & Notes */}
            <View className={cn('pt-4 border-t mb-4', isDark ? 'border-slate-800' : 'border-slate-100')}>
              <View className="flex-row items-center mb-2">
                <FileText size={16} color={isDark ? '#64748B' : '#94A3B8'} />
                <Text className={cn('text-sm ml-2', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  Description
                </Text>
              </View>
              <Text className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                {due.name}
              </Text>
              {due.notes && (
                <Text className={cn('text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  {due.notes}
                </Text>
              )}
            </View>

            {/* Progress Bar */}
            {due.amountPaid > 0 && (
              <View className="mb-4">
                <View className="flex-row justify-between mb-2">
                  <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                    Payment Progress
                  </Text>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>
                    {progressPercent.toFixed(0)}%
                  </Text>
                </View>
                <View className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                  <View
                    className="h-2 rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: due.status === 'paid' ? '#10B981' : theme.primary,
                    }}
                  />
                </View>
              </View>
            )}

            {/* Details Grid */}
            <View className={cn('pt-4 border-t', isDark ? 'border-slate-800' : 'border-slate-100')}>
              <View className="flex-row mb-3">
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Calendar size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                    <Text className={cn('text-xs ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      Due Date
                    </Text>
                  </View>
                  <Text className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                    {formatShortDate(due.dueDate)}
                  </Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Clock size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                    <Text className={cn('text-xs ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      Created
                    </Text>
                  </View>
                  <Text className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                    {formatShortDate(due.createdAt)}
                  </Text>
                </View>
              </View>

              {/* Created By */}
              <View className="flex-row items-center">
                <UserCheck size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                <Text className={cn('text-xs ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  Created by:{' '}
                </Text>
                <Text className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  {createdByMember ? `${createdByMember.firstName} ${createdByMember.lastName}` : 'Admin'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Recurring Info */}
        {due.isRecurring && (
          <View className="px-5 mt-4">
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              className={cn('p-4 rounded-2xl flex-row items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
              style={cardShadow}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${theme.primary}20` }}
              >
                <Repeat size={20} color={theme.primary} />
              </View>
              <View className="flex-1">
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                  Recurring Payment
                </Text>
                <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
                  {due.recurringFrequency === 'weekly' ? 'Every week' : due.recurringFrequency === 'biweekly' ? 'Every 2 weeks' : 'Every month'}
                  {due.recurringEndDate && ` until ${formatShortDate(due.recurringEndDate)}`}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Pending Submissions */}
        {pendingSubmissions.length > 0 && (
          <View className="px-5 mt-4">
            <Animated.View entering={FadeIn.delay(250).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-amber-400' : 'text-amber-600')}>
                Pending Confirmation
              </Text>
              {pendingSubmissions.map((submission, index) => (
                <View
                  key={submission.id}
                  className={cn(
                    'p-4 rounded-2xl border mb-2',
                    isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'
                  )}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Clock size={18} color="#F59E0B" />
                      <Text className={cn('ml-2 font-medium', isDark ? 'text-amber-300' : 'text-amber-700')}>
                        {formatCurrency(submission.amount)}
                      </Text>
                      <Text className={cn('ml-2 text-xs', isDark ? 'text-amber-400/70' : 'text-amber-600')}>
                        via {PAYMENT_METHODS[submission.method]?.label || submission.method}
                      </Text>
                    </View>
                    <Text className={cn('text-xs', isDark ? 'text-amber-400/70' : 'text-amber-600')}>
                      {formatShortDate(submission.submittedAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          </View>
        )}

        {/* Payment History */}
        {relatedTransactions.length > 0 && (
          <View className="px-5 mt-4">
            <Animated.View entering={FadeIn.delay(300).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Payment History
              </Text>
              <View
                className={cn('rounded-2xl overflow-hidden border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                style={cardShadow}
              >
                {relatedTransactions.map((transaction, index) => {
                  const processedByMember = members.find((m) => m.id === transaction.processedBy || m.userId === transaction.processedBy);

                  return (
                    <View
                      key={transaction.id}
                      className={cn(
                        'p-4',
                        index !== relatedTransactions.length - 1 && (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100')
                      )}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                          <View
                            className={cn(
                              'w-8 h-8 rounded-full items-center justify-center mr-2',
                              transaction.type === 'payment' ? 'bg-emerald-500/15' : 'bg-red-500/15'
                            )}
                          >
                            {transaction.type === 'payment' ? (
                              <CheckCircle2 size={16} color="#10B981" />
                            ) : (
                              <DollarSign size={16} color="#EF4444" />
                            )}
                          </View>
                          <View>
                            <Text className={cn('font-semibold capitalize', isDark ? 'text-white' : 'text-slate-900')}>
                              {transaction.type}
                            </Text>
                            {transaction.method && (
                              <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                via {PAYMENT_METHODS[transaction.method]?.label || transaction.method}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Text className={cn('font-bold', transaction.type === 'payment' ? 'text-emerald-500' : 'text-red-500')}>
                          {transaction.type === 'payment' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </Text>
                      </View>
                      <View className="flex-row items-center justify-between">
                        <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                          {formatShortDate(transaction.processedAt)}
                        </Text>
                        <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                          by {processedByMember ? `${processedByMember.firstName} ${processedByMember.lastName}` : 'Admin'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        )}

        {/* Paid Status Message */}
        {due.status === 'paid' && due.paidAt && (
          <View className="px-5 mt-4">
            <Animated.View
              entering={FadeIn.delay(350).duration(400)}
              className="p-5 rounded-2xl flex-row items-center bg-emerald-500/10 border border-emerald-500/20"
            >
              <View className="w-12 h-12 rounded-full bg-emerald-500/20 items-center justify-center mr-4">
                <CheckCircle2 size={24} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className={cn('font-semibold', isDark ? 'text-emerald-300' : 'text-emerald-700')}>
                  Payment Complete
                </Text>
                <Text className={cn('text-sm mt-0.5', isDark ? 'text-emerald-400/70' : 'text-emerald-600')}>
                  Fully paid on {formatShortDate(due.paidAt)}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Overdue Warning */}
        {due.status === 'overdue' && (
          <View className="px-5 mt-4">
            <Animated.View
              entering={FadeIn.delay(350).duration(400)}
              className="p-5 rounded-2xl flex-row items-center bg-red-500/10 border border-red-500/20"
            >
              <View className="w-12 h-12 rounded-full bg-red-500/20 items-center justify-center mr-4">
                <AlertCircle size={24} color="#EF4444" />
              </View>
              <View className="flex-1">
                <Text className={cn('font-semibold', isDark ? 'text-red-300' : 'text-red-700')}>
                  Payment Overdue
                </Text>
                <Text className={cn('text-sm mt-0.5', isDark ? 'text-red-400/70' : 'text-red-600')}>
                  Was due on {formatShortDate(due.dueDate)}
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Record Payment Button */}
        {due.status !== 'paid' && (
          <View className="px-5 mt-6">
            <Animated.View entering={FadeInUp.delay(400).duration(400)}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/financials/record-payment');
                }}
                className="py-4 rounded-2xl flex-row items-center justify-center"
                style={{ backgroundColor: theme.primary }}
              >
                <Receipt size={20} color="#FFFFFF" />
                <Text className="text-white font-bold text-base ml-2">Record Payment</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}

        {/* Remove Payment Button - Only for admins/teachers */}
        {isAdminOrTeacher && (
          <View className="px-5 mt-4">
            <Animated.View entering={FadeInUp.delay(450).duration(400)}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleRemovePayment();
                }}
                className={cn(
                  'py-4 rounded-2xl flex-row items-center justify-center border',
                  isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
                )}
              >
                <Trash2 size={20} color="#EF4444" />
                <Text className="text-red-500 font-bold text-base ml-2">Remove Payment</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
