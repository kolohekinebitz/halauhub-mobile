/**
 * Web-only version of the Financials screen.
 * Identical to index.tsx but with ALL react-native-reanimated imports removed.
 * Plain <View> replaces every <Animated.View> / <SafeAnimatedView>.
 * Plain <Pressable> replaces every <AnimatedPressable>.
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  FileText,
  Wallet,
  Receipt,
  CircleDollarSign,
  Settings,
  Send,
  Check,
  X,
  Download,
  User,
  Search,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type TabType = 'dues' | 'expenses' | 'history';

export default function FinancialsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();

  const [activeTab, setActiveTab] = useState<TabType>('dues');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  useEffect(() => {
    if (params.tab === 'dues') {
      setActiveTab('dues');
    } else if (params.tab === 'history') {
      setActiveTab('history');
    } else if (params.tab === 'expenses') {
      setActiveTab('expenses');
    }
  }, [params.tab]);

  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const isKumu = useAppStore((s) => s.isKumu);
  const getHalau = useAppStore((s) => s.getHalau);
  const getFinancialSummary = useAppStore((s) => s.getFinancialSummary);
  const getMemberDuesByHalau = useAppStore((s) => s.getMemberDuesByHalau);
  const getMemberDuesByMember = useAppStore((s) => s.getMemberDuesByMember);
  const getOverdueMemberDues = useAppStore((s) => s.getOverdueMemberDues);
  const getOverdueExpensesByHalau = useAppStore((s) => s.getOverdueExpensesByHalau);
  const getOverdueExpensesByMember = useAppStore((s) => s.getOverdueExpensesByMember);
  const getPendingApprovalExpenses = useAppStore((s) => s.getPendingApprovalExpenses);
  const getTransactionsByHalau = useAppStore((s) => s.getTransactionsByHalau);
  const getTransactionsByMember = useAppStore((s) => s.getTransactionsByMember);
  const getPendingPaymentSubmissions = useAppStore((s) => s.getPendingPaymentSubmissions);
  const rejectPaymentSubmission = useAppStore((s) => s.rejectPaymentSubmission);
  const members = useAppStore((s) => s.members);
  const memberDuesStore = useAppStore((s) => s.memberDues);
  const pendingPaymentSubmissionsStore = useAppStore((s) => s.pendingPaymentSubmissions);
  const financialTransactionsStore = useAppStore((s) => s.financialTransactions);

  const isAdmin = isKumu();
  const isGuardian = currentMember?.role === 'guardian';

  const myKeikiIds = useMemo(() => {
    if (!isGuardian || !currentMember) return [];
    return members
      .filter((m) => m.linkedToMemberId === currentMember.id && m.isKeiki)
      .map((m) => m.id);
  }, [isGuardian, currentMember, members]);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  const accentColors = {
    primary: theme.primary,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    blue: '#3B82F6',
  };

  const financialSummary = useMemo(() => {
    if (!currentHalauId) return { totalCollected: 0, totalPending: 0, totalOverdue: 0, totalOwedToMembers: 0 };
    return getFinancialSummary(currentHalauId);
  }, [currentHalauId, getFinancialSummary, memberDuesStore]);

  const memberDues = useMemo(() => {
    if (!currentHalauId || !currentMember) return [];
    let dues;
    if (isAdmin) {
      dues = getMemberDuesByHalau(currentHalauId);
    } else {
      const myDues = getMemberDuesByMember(currentMember.id);
      if (isGuardian && myKeikiIds.length > 0) {
        const keikiDues = myKeikiIds.flatMap((keikiId) => getMemberDuesByMember(keikiId));
        dues = [...myDues, ...keikiDues];
      } else {
        dues = myDues;
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const fiveDaysFromNowStr = fiveDaysFromNow.toISOString().split('T')[0];

    return dues.sort((a, b) => {
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      if (a.status !== 'paid' && b.status === 'paid') return -1;
      if (a.status === 'paid' && b.status === 'paid') {
        return (b.paidAt || b.dueDate).localeCompare(a.paidAt || a.dueDate);
      }
      const aIsPastDue = a.dueDate < todayStr;
      const bIsPastDue = b.dueDate < todayStr;
      const aIsDueSoon = !aIsPastDue && a.dueDate <= fiveDaysFromNowStr;
      const bIsDueSoon = !bIsPastDue && b.dueDate <= fiveDaysFromNowStr;
      if (aIsPastDue && !bIsPastDue) return -1;
      if (!aIsPastDue && bIsPastDue) return 1;
      if (aIsPastDue && bIsPastDue) return a.dueDate.localeCompare(b.dueDate);
      if (aIsDueSoon && !bIsDueSoon) return -1;
      if (!aIsDueSoon && bIsDueSoon) return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [currentHalauId, currentMember, isAdmin, isGuardian, myKeikiIds, getMemberDuesByHalau, getMemberDuesByMember, memberDuesStore]);

  const mostRecentDueId = useMemo(() => {
    if (isAdmin) return null;
    const unpaidDues = memberDues.filter((d) => d.status !== 'paid');
    if (unpaidDues.length === 0) return null;
    const today = new Date().toISOString().split('T')[0];
    const sortedByDate = [...unpaidDues].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const upcomingDue = sortedByDate.find((d) => d.dueDate >= today);
    return upcomingDue?.id || sortedByDate[sortedByDate.length - 1]?.id || null;
  }, [isAdmin, memberDues]);

  const overdueDues = useMemo(() => {
    if (!currentHalauId) return [];
    return getOverdueMemberDues(currentHalauId);
  }, [currentHalauId, getOverdueMemberDues, memberDuesStore]);

  const getMemberName = useCallback((memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  }, [members]);

  const filterableMembers = useMemo(() => {
    if (!isAdmin || !currentHalauId) return [];
    return members
      .filter((m) => m.halauId === currentHalauId)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [isAdmin, currentHalauId, members]);

  const filteredMemberOptions = useMemo(() => {
    if (!memberSearch.trim()) return filterableMembers;
    const q = memberSearch.toLowerCase();
    return filterableMembers.filter((m) =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  }, [filterableMembers, memberSearch]);

  const studentDueGroups = useMemo(() => {
    if (!isAdmin) return [];
    const today = new Date().toISOString().split('T')[0];
    const activeDues = memberDues.filter((d) => d.status !== 'paid');
    const grouped = new Map<string, typeof activeDues>();
    for (const due of activeDues) {
      const existing = grouped.get(due.memberId) ?? [];
      existing.push(due);
      grouped.set(due.memberId, existing);
    }
    const groups = Array.from(grouped.entries()).map(([memberId, dues]) => {
      const totalRemaining = dues.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0);
      const hasOverdue = dues.some((d) => d.dueDate < today);
      const sortedDues = [...dues].sort((a, b) => {
        const aOverdue = a.dueDate < today;
        const bOverdue = b.dueDate < today;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      return { memberId, dues: sortedDues, totalRemaining, hasOverdue };
    });
    const sorted = groups.sort((a, b) => {
      if (a.hasOverdue && !b.hasOverdue) return -1;
      if (!a.hasOverdue && b.hasOverdue) return 1;
      return getMemberName(a.memberId).localeCompare(getMemberName(b.memberId));
    });
    if (selectedMemberId) return sorted.filter((g) => g.memberId === selectedMemberId);
    return sorted;
  }, [isAdmin, memberDues, memberDuesStore, getMemberName, selectedMemberId]);

  const toggleStudent = useCallback((memberId: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) { next.delete(memberId); } else { next.add(memberId); }
      return next;
    });
  }, []);

  const pendingExpenses = useMemo(() => {
    if (!currentHalauId) return [];
    return getPendingApprovalExpenses(currentHalauId);
  }, [currentHalauId, getPendingApprovalExpenses]);

  const expenses = useMemo(() => {
    if (!currentHalauId || !currentMember) return [];
    let result;
    if (isAdmin) {
      result = getOverdueExpensesByHalau(currentHalauId);
    } else {
      result = getOverdueExpensesByMember(currentMember.id);
    }
    if (isAdmin && selectedMemberId) result = result.filter((e) => e.memberId === selectedMemberId);
    return result;
  }, [currentHalauId, currentMember, isAdmin, selectedMemberId, getOverdueExpensesByHalau, getOverdueExpensesByMember]);

  const transactions = useMemo(() => {
    if (!currentHalauId || !currentMember) return [];
    let result;
    if (isAdmin) {
      result = getTransactionsByHalau(currentHalauId);
    } else {
      result = getTransactionsByMember(currentMember.id);
    }
    if (isAdmin && selectedMemberId) result = result.filter((t) => t.memberId === selectedMemberId);
    return result.slice(0, 20);
  }, [currentHalauId, currentMember, isAdmin, selectedMemberId, getTransactionsByHalau, getTransactionsByMember, financialTransactionsStore]);

  const pendingPayments = useMemo(() => {
    if (!currentHalauId || !isAdmin) return [];
    return getPendingPaymentSubmissions(currentHalauId);
  }, [currentHalauId, isAdmin, getPendingPaymentSubmissions, pendingPaymentSubmissionsStore]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const getDueName = (memberDueId: string) => {
    const due = memberDuesStore.find((d) => d.id === memberDueId);
    return due?.name || 'Unknown Due';
  };

  const handleConfirmPayment = (submissionId: string) => {
    router.push(`/financials/record-payment?submissionId=${submissionId}` as never);
  };

  const handleRejectPayment = (submissionId: string) => {
    const submission = pendingPayments.find((s) => s.id === submissionId);
    if (!submission) return;
    const memberName = getMemberName(submission.memberId);
    Alert.alert(
      'Reject Payment',
      `Are you sure you want to reject ${memberName}'s payment submission? They will need to resubmit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            try {
              rejectPaymentSubmission(submissionId, 'Payment not received');
            } catch {
              Alert.alert('Error', 'Failed to reject payment. Please try again.');
            }
          },
        },
      ]
    );
  };

  const TABS: { id: TabType; label: string; icon: typeof DollarSign }[] = [
    { id: 'dues', label: 'Dues', icon: FileText },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'history', label: 'History', icon: Receipt },
  ];

  const lightCardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 8,
    elevation: 6,
  };

  const cardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.5 : 0.18,
    shadowRadius: 12,
    elevation: 10,
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
          style={{ paddingBottom: 24 }}
        >
          <View className="flex-row items-center justify-between px-5 py-4">
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              className="w-10 h-10 rounded-full bg-white/20 items-center justify-center active:bg-white/30"
            >
              <ArrowLeft size={22} color="#FFFFFF" />
            </Pressable>
            <Text className="text-white text-xl font-bold">Financials</Text>
            <View className="w-10" />
          </View>

          {isAdmin && (
            <View className="flex-row px-5 gap-3">
              <View className="flex-1">
                <View className="bg-white/15 rounded-2xl p-4 border border-white/10 relative items-center">
                  <View className="w-8 h-8 rounded-full bg-amber-400/30 items-center justify-center mb-2">
                    <Clock size={16} color="#fcd34d" />
                  </View>
                  <Text className="text-amber-200 text-[11px] font-medium mb-1">Pending</Text>
                  <Text className="text-white text-lg font-bold">{formatCurrency(financialSummary.totalPending)}</Text>
                  {pendingPayments.length > 0 && (
                    <View className="absolute -top-2 -right-2 bg-red-500 rounded-full min-w-[22px] h-[22px] items-center justify-center px-1.5">
                      <Text className="text-white text-xs font-bold">{pendingPayments.length}</Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="flex-1">
                <View className="bg-white/15 rounded-2xl p-4 border border-white/10 items-center">
                  <View className="w-8 h-8 rounded-full bg-red-400/30 items-center justify-center mb-2">
                    <AlertCircle size={16} color="#fca5a5" />
                  </View>
                  <Text className="text-red-200 text-[11px] font-medium mb-1">Overdue</Text>
                  <Text className="text-white text-lg font-bold">{formatCurrency(financialSummary.totalOverdue)}</Text>
                </View>
              </View>

              <View className="flex-1">
                <View className="bg-white/15 rounded-2xl p-4 border border-white/10 items-center">
                  <View className="w-8 h-8 rounded-full bg-purple-400/30 items-center justify-center mb-2">
                    <TrendingDown size={16} color="#c4b5fd" />
                  </View>
                  <Text className="text-purple-200 text-[11px] font-medium mb-1">Disburse</Text>
                  <Text className="text-white text-lg font-bold">{formatCurrency(financialSummary.totalOwedToMembers)}</Text>
                </View>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Quick Actions */}
        <View className="px-5 pt-5">
          {isAdmin ? (
            <View>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Quick Actions
              </Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <Pressable
                  onPress={() => router.push('/financials/manage-dues')}
                  className={cn('rounded-2xl border items-center justify-center p-4', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={[cardShadow, { flex: 1 }]}
                >
                  <View className="w-8 h-8 rounded-full items-center justify-center mb-2" style={{ backgroundColor: `${accentColors.primary}15` }}>
                    <Settings size={16} color={accentColors.primary} />
                  </View>
                  <Text className={cn('font-bold text-base text-center mb-0.5', isDark ? 'text-white' : 'text-slate-900')}>Set Up</Text>
                  <Text className={cn('text-[11px] text-center', isDark ? 'text-slate-400' : 'text-slate-500')}>Dues</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/financials/record-payment')}
                  className={cn('rounded-2xl border items-center justify-center p-4', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={[cardShadow, { flex: 1 }]}
                >
                  <View className="w-8 h-8 rounded-full items-center justify-center mb-2" style={{ backgroundColor: `${accentColors.success}15` }}>
                    <CircleDollarSign size={16} color={accentColors.success} />
                  </View>
                  <Text className={cn('font-bold text-base text-center mb-0.5', isDark ? 'text-white' : 'text-slate-900')}>Record</Text>
                  <Text className={cn('text-[11px] text-center', isDark ? 'text-slate-400' : 'text-slate-500')}>Payment</Text>
                </Pressable>

                <Pressable
                  onPress={() => router.push('/financials/export')}
                  className={cn('rounded-2xl border items-center justify-center p-4', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={[cardShadow, { flex: 1 }]}
                >
                  <View className="w-8 h-8 rounded-full items-center justify-center mb-2" style={{ backgroundColor: `${accentColors.blue}15` }}>
                    <Download size={16} color={accentColors.blue} />
                  </View>
                  <Text className={cn('font-bold text-base text-center mb-0.5', isDark ? 'text-white' : 'text-slate-900')}>Export</Text>
                  <Text className={cn('text-[11px] text-center', isDark ? 'text-slate-400' : 'text-slate-500')}>Data</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Quick Actions
              </Text>
              <Pressable
                onPress={() => router.push('/financials/request-reimbursement')}
                className={cn('p-4 rounded-2xl flex-row items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                style={cardShadow}
              >
                <View className="w-11 h-11 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${accentColors.purple}15` }}>
                  <Send size={20} color={accentColors.purple} />
                </View>
                <View className="flex-1">
                  <Text className={cn('font-semibold text-[15px]', isDark ? 'text-white' : 'text-slate-900')}>Request Reimbursement</Text>
                  <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>Submit an expense for approval</Text>
                </View>
                <ChevronRight size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Pending Approvals Alert */}
        {isAdmin && pendingExpenses.length > 0 && (
          <View className="px-5 mt-5">
            <Pressable
              onPress={() => setActiveTab('expenses')}
              className={cn('p-4 rounded-2xl flex-row items-center border', isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100')}
            >
              <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center mr-3">
                <AlertCircle size={20} color={accentColors.warning} />
              </View>
              <View className="flex-1">
                <Text className={cn('font-semibold', isDark ? 'text-amber-200' : 'text-amber-900')}>
                  {pendingExpenses.length} Pending Approval{pendingExpenses.length > 1 ? 's' : ''}
                </Text>
                <Text className={cn('text-xs mt-0.5', isDark ? 'text-amber-300/70' : 'text-amber-700')}>
                  Tap to review reimbursement requests
                </Text>
              </View>
              <ChevronRight size={18} color={accentColors.warning} />
            </Pressable>
          </View>
        )}

        {/* Confirm Payments */}
        {isAdmin && pendingPayments.length > 0 && (
          <View className="px-5 mt-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text className={cn('text-xs font-semibold uppercase tracking-wider', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                Confirm Payments
              </Text>
              <View className="bg-emerald-500 px-2 py-0.5 rounded-full">
                <Text className="text-white text-xs font-bold">{pendingPayments.length}</Text>
              </View>
            </View>
            <View className="gap-3">
              {pendingPayments.map((submission) => (
                <View
                  key={submission.id}
                  className={cn('p-4 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={lightCardShadow}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1 mr-3">
                      <Text className={cn('font-semibold text-[15px]', isDark ? 'text-white' : 'text-slate-900')}>{getMemberName(submission.memberId)}</Text>
                      <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>{getDueName(submission.memberDueId)}</Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-bold text-base text-emerald-500">{formatCurrency(submission.amount)}</Text>
                      <Text className={cn('text-xs capitalize mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>via {submission.method}</Text>
                    </View>
                  </View>
                  <View className={cn('pt-3 border-t flex-row gap-2', isDark ? 'border-slate-800' : 'border-slate-100')}>
                    <Pressable
                      onPress={() => handleRejectPayment(submission.id)}
                      className={cn('flex-1 py-2.5 rounded-xl flex-row items-center justify-center', isDark ? 'bg-red-500/10' : 'bg-red-50')}
                    >
                      <X size={16} color="#EF4444" />
                      <Text className="text-red-500 font-semibold text-sm ml-1.5">Reject</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleConfirmPayment(submission.id)}
                      className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center bg-emerald-500"
                    >
                      <Check size={16} color="#FFFFFF" />
                      <Text className="text-white font-semibold text-sm ml-1.5">Confirm</Text>
                    </Pressable>
                  </View>
                  <Text className={cn('text-xs mt-2 text-center', isDark ? 'text-slate-600' : 'text-slate-400')}>
                    Submitted {formatDate(submission.submittedAt)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className={cn('h-px mx-5 my-5', isDark ? 'bg-slate-800' : 'bg-slate-200')} />

        {/* Member Filter — admin only */}
        {isAdmin && (
          <View className="px-5 mb-4">
            <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Filter by Member
            </Text>
            <Pressable
              onPress={() => {
                setShowMemberDropdown((prev) => !prev);
                setMemberSearch('');
              }}
              className={cn(
                'flex-row items-center rounded-xl px-3 py-2.5 border',
                isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              )}
            >
              <Search size={15} color="#94A3B8" />
              <Text
                className={cn(
                  'flex-1 ml-2 text-[14px]',
                  selectedMemberId
                    ? (isDark ? 'text-white' : 'text-slate-900')
                    : (isDark ? 'text-slate-500' : 'text-slate-400')
                )}
              >
                {selectedMemberId ? getMemberName(selectedMemberId) : 'All members'}
              </Text>
              {selectedMemberId ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setSelectedMemberId(null);
                    setMemberSearch('');
                    setShowMemberDropdown(false);
                  }}
                >
                  <X size={15} color="#94A3B8" />
                </Pressable>
              ) : (
                <ChevronDown size={15} color="#94A3B8" />
              )}
            </Pressable>

            {showMemberDropdown && (
              <View
                className={cn(
                  'mt-1 rounded-xl border overflow-hidden',
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                )}
                style={{ maxHeight: 260 }}
              >
                <View className={cn('flex-row items-center px-3 py-2 border-b', isDark ? 'border-slate-800' : 'border-slate-100')}>
                  <Search size={14} color="#94A3B8" />
                  <TextInput
                    value={memberSearch}
                    onChangeText={setMemberSearch}
                    placeholder="Search name..."
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    className={cn('flex-1 ml-2 text-[14px]', isDark ? 'text-white' : 'text-slate-900')}
                    autoFocus
                  />
                  {memberSearch.length > 0 && (
                    <Pressable hitSlop={8} onPress={() => setMemberSearch('')}>
                      <X size={14} color="#94A3B8" />
                    </Pressable>
                  )}
                </View>
                <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 210 }}>
                  <Pressable
                    onPress={() => {
                      setSelectedMemberId(null);
                      setShowMemberDropdown(false);
                      setMemberSearch('');
                    }}
                    className={cn('flex-row items-center px-3 py-2.5', !selectedMemberId && (isDark ? 'bg-slate-800' : 'bg-slate-50'))}
                  >
                    <Text className={cn('text-[14px]', !selectedMemberId ? (isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold') : (isDark ? 'text-slate-400' : 'text-slate-600'))}>
                      All members
                    </Text>
                  </Pressable>
                  {filteredMemberOptions.map((m) => (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        setSelectedMemberId(m.id);
                        setShowMemberDropdown(false);
                        setMemberSearch('');
                      }}
                      className={cn('flex-row items-center px-3 py-2.5', selectedMemberId === m.id && (isDark ? 'bg-slate-800' : 'bg-slate-50'))}
                    >
                      <Text className={cn('text-[14px]', selectedMemberId === m.id ? (isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold') : (isDark ? 'text-slate-300' : 'text-slate-700'))}>
                        {m.firstName} {m.lastName}
                      </Text>
                      {m.role === 'student' && (
                        <Text className={cn('ml-2 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>student</Text>
                      )}
                    </Pressable>
                  ))}
                  {filteredMemberOptions.length === 0 && (
                    <View className="px-3 py-4 items-center">
                      <Text className={cn('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>No members found</Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Tab Bar */}
        <View className="px-5 mb-4">
          <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>Browse</Text>
          <View className="flex-row gap-2">
            {TABS.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex-row items-center justify-center px-4 py-3 rounded-xl border',
                  activeTab === tab.id ? '' : isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                )}
                style={[
                  activeTab === tab.id ? { backgroundColor: theme.primary, borderColor: theme.primary } : lightCardShadow,
                ]}
              >
                <tab.icon size={16} color={activeTab === tab.id ? '#FFFFFF' : isDark ? '#64748B' : '#94A3B8'} />
                <Text className={cn('ml-2 font-semibold text-[13px]', activeTab === tab.id ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-600')}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-5">
          {/* Dues Tab */}
          {activeTab === 'dues' && (
            <View>
              {isAdmin ? (
                studentDueGroups.length === 0 ? (
                  <View
                    className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                    style={lightCardShadow}
                  >
                    <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <FileText size={28} color={isDark ? '#475569' : '#94A3B8'} />
                    </View>
                    <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>No outstanding dues</Text>
                    <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>All students are paid up!</Text>
                  </View>
                ) : (
                  studentDueGroups.map((group) => {
                    const isExpanded = expandedStudents.has(group.memberId);
                    const today = new Date().toISOString().split('T')[0];
                    return (
                      <View
                        key={group.memberId}
                        className={cn(
                          'rounded-2xl overflow-hidden border mb-2',
                          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100',
                          group.hasOverdue && (isDark ? 'border-red-900/60' : 'border-red-100')
                        )}
                        style={lightCardShadow}
                      >
                        <Pressable
                          onPress={() => toggleStudent(group.memberId)}
                          className={cn('px-4 py-3.5 flex-row items-center', group.hasOverdue && (isDark ? 'bg-red-500/5' : 'bg-red-50/60'))}
                        >
                          <View className={cn('w-9 h-9 rounded-full items-center justify-center mr-3', group.hasOverdue ? 'bg-red-500/15' : isDark ? 'bg-slate-700' : 'bg-slate-100')}>
                            <User size={16} color={group.hasOverdue ? '#EF4444' : isDark ? '#94A3B8' : '#64748B'} />
                          </View>
                          <View className="flex-1 mr-2">
                            <Text className={cn('font-semibold text-[15px]', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>
                              {getMemberName(group.memberId)}
                            </Text>
                            <Text className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                              {group.dues.length} due{group.dues.length !== 1 ? 's' : ''}{group.hasOverdue ? ' · has overdue' : ''}
                            </Text>
                          </View>
                          <View className="items-end mr-2">
                            <Text className={cn('font-bold text-[16px]', group.hasOverdue ? 'text-red-500' : isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                              {formatCurrency(group.totalRemaining)}
                            </Text>
                            <Text className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>remaining</Text>
                          </View>
                          <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                            <ChevronDown size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                          </View>
                        </Pressable>

                        {isExpanded && (
                          <View className={cn('border-t', isDark ? 'border-slate-800' : 'border-slate-100')}>
                            {group.dues.map((due, dueIndex) => {
                              const isPastDue = due.dueDate < today;
                              const fiveDays = new Date();
                              fiveDays.setDate(fiveDays.getDate() + 5);
                              const isDueSoon = !isPastDue && due.dueDate <= fiveDays.toISOString().split('T')[0];
                              const remaining = due.amount - due.amountPaid;
                              return (
                                <Pressable
                                  key={due.id}
                                  onPress={() => router.push(`/financials/due/${due.id}`)}
                                  className={cn(
                                    'px-4 py-3 flex-row items-center active:opacity-80',
                                    dueIndex !== group.dues.length - 1 && (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'),
                                    isPastDue && (isDark ? 'bg-red-500/5' : 'bg-red-50/40')
                                  )}
                                >
                                  <View className="w-1 self-stretch rounded-full mr-3" style={{ backgroundColor: isPastDue ? '#EF4444' : isDueSoon ? '#F59E0B' : theme.primary }} />
                                  <View className="flex-1 mr-2">
                                    <Text className={cn('font-medium text-[13px]', isPastDue ? 'text-red-500' : isDark ? 'text-slate-200' : 'text-slate-800')} numberOfLines={1}>
                                      {due.name}
                                    </Text>
                                    <Text className={cn('text-[11px] mt-0.5', isPastDue ? 'text-red-400' : isDueSoon ? 'text-amber-500' : isDark ? 'text-slate-500' : 'text-slate-400')}>
                                      {isPastDue ? 'Was due ' : isDueSoon ? 'Due soon · ' : 'Due '}{formatDate(due.dueDate)}
                                    </Text>
                                  </View>
                                  <View className="items-end mr-2">
                                    <Text className={cn('font-semibold text-[13px]', isPastDue ? 'text-red-500' : isDark ? 'text-white' : 'text-slate-900')}>
                                      {formatCurrency(remaining)}
                                    </Text>
                                    {due.amountPaid > 0 && (
                                      <Text className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>{formatCurrency(due.amountPaid)} paid</Text>
                                    )}
                                  </View>
                                  <ChevronRight size={14} color={isDark ? '#475569' : '#CBD5E1'} />
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })
                )
              ) : (
                memberDues.length === 0 ? (
                  <View
                    className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                    style={lightCardShadow}
                  >
                    <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <FileText size={28} color={isDark ? '#475569' : '#94A3B8'} />
                    </View>
                    <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>No dues found</Text>
                    <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>You're all caught up!</Text>
                  </View>
                ) : (
                  memberDues.map((due) => {
                    const isMostRecentDue = due.id === mostRecentDueId;
                    const today = new Date().toISOString().split('T')[0];
                    const fiveDaysFromNow = new Date();
                    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
                    const fiveDaysFromNowStr = fiveDaysFromNow.toISOString().split('T')[0];
                    const isPastDue = due.status !== 'paid' && due.dueDate < today;
                    const isDueSoon = due.status !== 'paid' && !isPastDue && due.dueDate <= fiveDaysFromNowStr;
                    const displayStatus = due.status === 'paid' ? 'paid' : isPastDue ? 'past due' : isDueSoon ? 'due soon' : 'pending';
                    const progressPct = Math.min((due.amountPaid / due.amount) * 100, 100);

                    return (
                      <Pressable
                        key={due.id}
                        onPress={() => router.push(`/financials/dues/${due.id}`)}
                        className={cn('px-3 py-2.5 rounded-xl mb-2 border active:opacity-90', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                        style={[
                          lightCardShadow,
                          isMostRecentDue && { borderLeftWidth: 4, borderLeftColor: theme.primary, backgroundColor: isDark ? `${theme.primary}15` : `${theme.primary}08` },
                          isPastDue && { borderLeftWidth: 4, borderLeftColor: '#EF4444', backgroundColor: isDark ? '#EF444415' : '#FEF2F2' },
                          isDueSoon && !isMostRecentDue && { borderLeftWidth: 4, borderLeftColor: '#F59E0B', backgroundColor: isDark ? '#F59E0B15' : '#FFFBEB' },
                        ]}
                      >
                        <View className="flex-row items-center">
                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center">
                              <Text className={cn('font-semibold text-[14px] flex-1', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>
                                {due.name}
                              </Text>
                              <View className={cn('px-1.5 py-0.5 rounded ml-2', displayStatus === 'paid' ? 'bg-emerald-500/15' : displayStatus === 'past due' ? 'bg-red-500/15' : displayStatus === 'due soon' ? 'bg-amber-500/15' : isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                                <Text className={cn('text-[10px] font-semibold uppercase', displayStatus === 'paid' ? 'text-emerald-600' : displayStatus === 'past due' ? 'text-red-500' : displayStatus === 'due soon' ? 'text-amber-600' : isDark ? 'text-slate-400' : 'text-slate-500')}>
                                  {displayStatus}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View className="items-end">
                            <Text className={cn('text-[13px] font-bold', isDark ? 'text-slate-200' : 'text-slate-700')}>
                              {formatCurrency(due.amountPaid)}/{formatCurrency(due.amount)}
                            </Text>
                            <Text className={cn('text-[10px]', isPastDue ? 'text-red-500' : isDueSoon ? 'text-amber-600' : isDark ? 'text-slate-500' : 'text-slate-500')}>
                              {isPastDue ? 'Was due' : 'Due'} {formatDate(due.dueDate)}
                            </Text>
                          </View>
                          <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                        </View>
                        {/* Progress bar — use numeric width on web */}
                        <View className={cn('h-1 rounded-full overflow-hidden mt-2', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                          <View
                            className="h-1 rounded-full"
                            style={{
                              width: `${progressPct}%` as unknown as number,
                              backgroundColor: due.status === 'paid' ? accentColors.success : isPastDue ? '#EF4444' : theme.primary,
                            }}
                          />
                        </View>
                      </Pressable>
                    );
                  })
                )
              )}
            </View>
          )}

          {/* Expenses Tab */}
          {activeTab === 'expenses' && (
            <View>
              {expenses.length === 0 && pendingExpenses.length === 0 ? (
                <View
                  className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={lightCardShadow}
                >
                  <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <Wallet size={28} color={isDark ? '#475569' : '#94A3B8'} />
                  </View>
                  <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>No expenses found</Text>
                  <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>
                    {isAdmin ? 'No reimbursement requests yet' : 'Submit a request to get started'}
                  </Text>
                </View>
              ) : (
                <>
                  {isAdmin && pendingExpenses.length > 0 && (
                    <View className="mb-3">
                      <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2', isDark ? 'text-amber-400' : 'text-amber-600')}>Awaiting Approval</Text>
                      {pendingExpenses.map((expense) => (
                        <Pressable
                          key={expense.id}
                          onPress={() => router.push(`/financials/expense/${expense.id}`)}
                          className={cn('px-3 py-2.5 rounded-xl mb-2 border-l-4 border-amber-500 active:opacity-90', isDark ? 'bg-slate-900' : 'bg-white')}
                          style={lightCardShadow}
                        >
                          <View className="flex-row items-center">
                            <View className="flex-1 mr-2">
                              <Text className={cn('font-semibold text-[14px]', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>{expense.description}</Text>
                              <Text className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} numberOfLines={1}>
                                {getMemberName(expense.memberId)} · {formatDate(expense.requestedAt)}
                              </Text>
                            </View>
                            <Text className="text-amber-500 font-bold text-[13px]">{formatCurrency(expense.amount)}</Text>
                            <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {expenses.length > 0 && (
                    <>
                      {isAdmin && pendingExpenses.length > 0 && (
                        <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2', isDark ? 'text-slate-500' : 'text-slate-400')}>All Expenses</Text>
                      )}
                      {expenses.map((expense) => (
                        <Pressable
                          key={expense.id}
                          onPress={() => router.push(`/financials/expense/${expense.id}`)}
                          className={cn('px-3 py-2.5 rounded-xl mb-2 border active:opacity-90', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                          style={lightCardShadow}
                        >
                          <View className="flex-row items-center">
                            <View className="flex-1 mr-2">
                              <View className="flex-row items-center">
                                <Text className={cn('font-semibold text-[14px] flex-1', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>{expense.description}</Text>
                                <View className={cn('px-1.5 py-0.5 rounded ml-2', expense.status === 'released' ? 'bg-emerald-500/15' : expense.status === 'approved' ? 'bg-blue-500/15' : expense.status === 'denied' ? 'bg-red-500/15' : 'bg-amber-500/15')}>
                                  <Text className={cn('text-[10px] font-semibold uppercase', expense.status === 'released' ? 'text-emerald-600' : expense.status === 'approved' ? 'text-blue-600' : expense.status === 'denied' ? 'text-red-500' : 'text-amber-600')}>
                                    {expense.status.replace('_', ' ')}
                                  </Text>
                                </View>
                              </View>
                              {isAdmin && (
                                <Text className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} numberOfLines={1}>
                                  {getMemberName(expense.memberId)} · {formatDate(expense.requestedAt)}
                                </Text>
                              )}
                              {!isAdmin && (
                                <Text className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} numberOfLines={1}>
                                  {formatDate(expense.requestedAt)}
                                </Text>
                              )}
                            </View>
                            <Text className={cn('font-bold text-[13px]', isDark ? 'text-white' : 'text-slate-900')}>{formatCurrency(expense.amount)}</Text>
                            <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <View>
              {transactions.length === 0 ? (
                <View
                  className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={lightCardShadow}
                >
                  <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <Receipt size={28} color={isDark ? '#475569' : '#94A3B8'} />
                  </View>
                  <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>No transactions yet</Text>
                  <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>Transactions will appear here</Text>
                </View>
              ) : (
                <View className={cn('rounded-xl overflow-hidden border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')} style={lightCardShadow}>
                  {transactions.map((transaction, index) => (
                    <Pressable
                      key={transaction.id}
                      onPress={() => router.push(`/financials/transaction/${transaction.id}`)}
                      className={cn('px-3 py-2.5 active:opacity-80', index !== transactions.length - 1 && (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'))}
                    >
                      <View className="flex-row items-center">
                        <View className={cn('w-8 h-8 rounded-lg items-center justify-center mr-2.5', transaction.type === 'payment' ? 'bg-emerald-500/15' : transaction.type === 'refund' ? 'bg-red-500/15' : 'bg-purple-500/15')}>
                          {transaction.type === 'payment' ? (
                            <TrendingUp size={14} color={accentColors.success} />
                          ) : transaction.type === 'refund' ? (
                            <TrendingDown size={14} color={accentColors.danger} />
                          ) : (
                            <Wallet size={14} color={accentColors.purple} />
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className={cn('font-medium capitalize text-[14px]', isDark ? 'text-white' : 'text-slate-900')}>{transaction.type.replace('_', ' ')}</Text>
                            {transaction.method && (
                              <Text className={cn('text-[10px] capitalize ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>via {transaction.method}</Text>
                            )}
                          </View>
                          <Text className={cn('text-[11px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
                            {isAdmin ? `${getMemberName(transaction.memberId)} · ` : ''}{formatDate(transaction.processedAt)}
                            {isAdmin && transaction.processedBy && ` · by ${getMemberName(transaction.processedBy)}`}
                          </Text>
                        </View>
                        <Text className={cn('font-bold text-[13px]', transaction.type === 'payment' ? 'text-emerald-500' : 'text-red-500')}>
                          {transaction.type === 'payment' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </Text>
                        <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
