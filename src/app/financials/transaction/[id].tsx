import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
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
  CheckCircle2,
  User,
  UserCheck,
  FileText,
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Tag,
  Receipt,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { PaymentMethod, FinancialTransaction } from '@/lib/types';

const PAYMENT_METHODS: Record<PaymentMethod, { label: string; color: string; icon: typeof CreditCard }> = {
  venmo: { label: 'Venmo', color: '#008CFF', icon: CreditCard },
  zelle: { label: 'Zelle', color: '#6D1ED4', icon: CreditCard },
  cash: { label: 'Cash', color: '#10B981', icon: DollarSign },
  check: { label: 'Check', color: '#F59E0B', icon: FileText },
};

export default function TransactionDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  const financialTransactions = useAppStore((s) => s.financialTransactions);
  const members = useAppStore((s) => s.members);
  const memberDues = useAppStore((s) => s.memberDues);
  const overdueExpenses = useAppStore((s) => s.overdueExpenses);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Find the specific transaction
  const transaction = useMemo(() => {
    return financialTransactions.find((t: FinancialTransaction) => t.id === id);
  }, [financialTransactions, id]);

  // Get member info (who the transaction is for)
  const member = useMemo(() => {
    if (!transaction) return null;
    return members.find((m) => m.id === transaction.memberId);
  }, [transaction, members]);

  // Get who processed this transaction
  const processedByMember = useMemo(() => {
    if (!transaction) return null;
    return members.find((m) => m.id === transaction.processedBy || m.userId === transaction.processedBy);
  }, [transaction, members]);

  // Get related due or expense
  const relatedDue = useMemo(() => {
    if (!transaction?.reference) return null;
    return memberDues.find((d) => d.id === transaction.reference);
  }, [transaction, memberDues]);

  const relatedExpense = useMemo(() => {
    if (!transaction?.reference) return null;
    return overdueExpenses.find((e) => e.id === transaction.reference);
  }, [transaction, overdueExpenses]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
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

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTransactionTypeInfo = (type: string) => {
    switch (type) {
      case 'payment':
        return {
          label: 'Payment Received',
          color: '#10B981',
          bgColor: 'bg-emerald-500/15',
          icon: TrendingUp,
          description: 'Payment received from member',
        };
      case 'refund':
        return {
          label: 'Refund Issued',
          color: '#EF4444',
          bgColor: 'bg-red-500/15',
          icon: TrendingDown,
          description: 'Refund issued to member',
        };
      case 'expense_release':
        return {
          label: 'Expense Released',
          color: '#8B5CF6',
          bgColor: 'bg-purple-500/15',
          icon: Wallet,
          description: 'Expense reimbursement released',
        };
      default:
        return {
          label: 'Transaction',
          color: '#64748B',
          bgColor: isDark ? 'bg-slate-800' : 'bg-slate-100',
          icon: Receipt,
          description: 'Financial transaction',
        };
    }
  };

  if (!transaction) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-slate-50')}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text className={cn('text-lg', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Transaction not found
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

  const typeInfo = getTransactionTypeInfo(transaction.type);
  const TypeIcon = typeInfo.icon;
  const paymentMethodInfo = transaction.method ? PAYMENT_METHODS[transaction.method] : null;

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
          colors={
            transaction.type === 'payment'
              ? ['#059669', '#10B981']
              : transaction.type === 'refund'
              ? ['#DC2626', '#EF4444']
              : [theme.gradientStart, theme.gradientEnd]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingBottom: 32 }}
        >
          {/* Top Bar */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <BackButton color="#FFFFFF" />

            <Text className="text-white text-lg font-semibold">Transaction Details</Text>

            <View className="w-10" />
          </View>

          {/* Amount Display */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center px-5">
            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3">
              <TypeIcon size={32} color="#FFFFFF" />
            </View>
            <Text className="text-white/70 text-sm mb-1">{typeInfo.label}</Text>
            <Text className="text-white text-4xl font-bold">
              {transaction.type === 'payment' ? '+' : '-'}{formatCurrency(transaction.amount)}
            </Text>
          </Animated.View>
        </LinearGradient>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Transaction Info Card */}
        <View className="px-5 -mt-4">
          <Animated.View
            entering={FadeInUp.delay(150).duration(400)}
            className={cn('rounded-2xl p-5 border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
            style={cardShadow}
          >
            {/* Date & Time */}
            <View className="flex-row items-center mb-4 pb-4 border-b" style={{ borderColor: isDark ? '#1e293b' : '#f1f5f9' }}>
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${typeInfo.color}20` }}
              >
                <Calendar size={24} color={typeInfo.color} />
              </View>
              <View className="flex-1">
                <Text className={cn('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  Processed On
                </Text>
                <Text className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  {formatDate(transaction.processedAt)}
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  at {formatTime(transaction.processedAt)}
                </Text>
              </View>
            </View>

            {/* Member */}
            <View className="flex-row items-center mb-4">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              >
                <User size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </View>
              <View className="flex-1">
                <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  {transaction.type === 'payment' ? 'Paid By' : 'Paid To'}
                </Text>
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  {member ? `${member.firstName} ${member.lastName}` : 'Unknown Member'}
                </Text>
              </View>
            </View>

            {/* Processed By */}
            <View className="flex-row items-center mb-4">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              >
                <UserCheck size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </View>
              <View className="flex-1">
                <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  Recorded By
                </Text>
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                  {processedByMember ? `${processedByMember.firstName} ${processedByMember.lastName}` : 'Admin'}
                </Text>
              </View>
            </View>

            {/* Payment Method */}
            {paymentMethodInfo && (
              <View className="flex-row items-center mb-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: `${paymentMethodInfo.color}20` }}
                >
                  <CreditCard size={20} color={paymentMethodInfo.color} />
                </View>
                <View className="flex-1">
                  <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                    Payment Method
                  </Text>
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                    {paymentMethodInfo.label}
                  </Text>
                </View>
              </View>
            )}

            {/* Category */}
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              >
                <Tag size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </View>
              <View className="flex-1">
                <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  Category
                </Text>
                <Text className={cn('font-semibold capitalize', isDark ? 'text-white' : 'text-slate-900')}>
                  {typeof transaction.category === 'string' ? transaction.category.replace(/_/g, ' ') : 'General'}
                </Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Related Due */}
        {relatedDue && (
          <View className="px-5 mt-4">
            <Animated.View entering={FadeIn.delay(200).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Related Due
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/financials/due/${relatedDue.id}`);
                }}
                className={cn('p-4 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                style={cardShadow}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                      {relatedDue.name}
                    </Text>
                    <Text className={cn('text-sm mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      Due: {formatShortDate(relatedDue.dueDate)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className={cn('font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                      {formatCurrency(relatedDue.amount)}
                    </Text>
                    <View
                      className={cn(
                        'px-2 py-0.5 rounded mt-1',
                        relatedDue.status === 'paid'
                          ? 'bg-emerald-500/15'
                          : relatedDue.status === 'partial'
                          ? 'bg-amber-500/15'
                          : relatedDue.status === 'overdue'
                          ? 'bg-red-500/15'
                          : isDark
                          ? 'bg-slate-800'
                          : 'bg-slate-100'
                      )}
                    >
                      <Text
                        className={cn(
                          'text-xs font-medium uppercase',
                          relatedDue.status === 'paid'
                            ? 'text-emerald-600'
                            : relatedDue.status === 'partial'
                            ? 'text-amber-600'
                            : relatedDue.status === 'overdue'
                            ? 'text-red-500'
                            : isDark
                            ? 'text-slate-400'
                            : 'text-slate-500'
                        )}
                      >
                        {relatedDue.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        )}

        {/* Related Expense */}
        {relatedExpense && (
          <View className="px-5 mt-4">
            <Animated.View entering={FadeIn.delay(200).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Related Expense
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/financials/expense/${relatedExpense.id}`);
                }}
                className={cn('p-4 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                style={cardShadow}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                      {relatedExpense.description}
                    </Text>
                    <Text className={cn('text-sm mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      {relatedExpense.category}
                    </Text>
                  </View>
                  <Text className={cn('font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                    {formatCurrency(relatedExpense.amount)}
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        )}

        {/* Notes */}
        {transaction.notes && (
          <View className="px-5 mt-4">
            <Animated.View entering={FadeIn.delay(250).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Notes
              </Text>
              <View
                className={cn('p-4 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                style={cardShadow}
              >
                <View className="flex-row items-start">
                  <FileText size={18} color={isDark ? '#64748B' : '#94A3B8'} style={{ marginTop: 2 }} />
                  <Text className={cn('flex-1 ml-3', isDark ? 'text-slate-300' : 'text-slate-600')}>
                    {transaction.notes}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Success Badge */}
        <View className="px-5 mt-6">
          <Animated.View
            entering={FadeIn.delay(300).duration(400)}
            className={cn('p-4 rounded-2xl flex-row items-center', typeInfo.bgColor)}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${typeInfo.color}30` }}
            >
              <CheckCircle2 size={20} color={typeInfo.color} />
            </View>
            <View className="flex-1">
              <Text style={{ color: typeInfo.color }} className="font-semibold">
                Transaction Complete
              </Text>
              <Text className={cn('text-sm mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                {typeInfo.description}
              </Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
