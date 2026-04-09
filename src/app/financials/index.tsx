import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Alert,
  LayoutAnimation,
  UIManager,
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
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Plus,
  FileText,
  Wallet,
  Receipt,
  CircleDollarSign,
  Settings,
  Send,
  Check,
  X,
  UserCheck,
  Download,
  User,
  Search,
  Sparkles,
  ChevronDown as ChevronDownSmall,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Enable LayoutAnimation on Android (no-op on web/iOS)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabType = 'dues' | 'expenses' | 'history';

// Native animated pressable with scale feedback
const NativeAnimatedPressable = ({ children, onPress, style, className: classNameProp, containerStyle }: {
  children: React.ReactNode;
  onPress: () => void;
  style?: object;
  className?: string;
  containerStyle?: object;
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15, stiffness: 400 }); }}
      style={containerStyle}
    >
      <Animated.View style={[animatedStyle, style, { flex: 1 }]} className={classNameProp}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Web fallback — plain pressable, no Reanimated worklets
const WebPressable = ({ children, onPress, style, className: classNameProp, containerStyle }: {
  children: React.ReactNode;
  onPress: () => void;
  style?: object;
  className?: string;
  containerStyle?: object;
}) => (
  <Pressable onPress={onPress} style={[containerStyle, style]} className={classNameProp}>
    {children}
  </Pressable>
);

const AnimatedPressable = Platform.OS === 'web' ? WebPressable : NativeAnimatedPressable;

// Web-safe Animated.View — strips Reanimated entering/exiting props and percentage widths on web
const SafeAnimatedView = Platform.OS === 'web'
  ? ({ children, entering: _entering, exiting: _exiting, style, className: cls }: {
      children?: React.ReactNode;
      entering?: unknown;
      exiting?: unknown;
      style?: object | object[];
      className?: string;
    }) => {
      // Flatten style array and replace percentage width strings with undefined (unsupported on web)
      const flatStyle = Array.isArray(style)
        ? Object.assign({}, ...style.filter(Boolean))
        : style || {};
      const safeStyle = typeof (flatStyle as Record<string, unknown>).width === 'string'
        ? { ...flatStyle, width: undefined }
        : flatStyle;
      return <View style={safeStyle as object} className={cls}>{children}</View>;
    }
  : Animated.View;

export default function FinancialsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();

  const [activeTab, setActiveTab] = useState<TabType>('dues');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  // Member filter — admin only; filters dues/expenses/history by a single member
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'at_risk' | 'overdue' | 'high_balance' | 'recently_paid' | null>(null);

  // Handle URL params for tab selection
  useEffect(() => {
    if (params.tab === 'dues') {
      setActiveTab('dues');
    } else if (params.tab === 'history') {
      setActiveTab('history');
    } else if (params.tab === 'expenses') {
      setActiveTab('expenses');
    }
  }, [params.tab]);

  // Store selectors
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
  const confirmPaymentSubmission = useAppStore((s) => s.confirmPaymentSubmission);
  const rejectPaymentSubmission = useAppStore((s) => s.rejectPaymentSubmission);
  const members = useAppStore((s) => s.members);
  const memberDuesStore = useAppStore((s) => s.memberDues);
  const pendingPaymentSubmissionsStore = useAppStore((s) => s.pendingPaymentSubmissions);
  const financialTransactionsStore = useAppStore((s) => s.financialTransactions);

  const isAdmin = isKumu();

  // Check if current member is a guardian with keiki
  const isGuardian = currentMember?.role === 'guardian';
  const myKeikiIds = useMemo(() => {
    if (!isGuardian || !currentMember) return [];
    return members
      .filter((m) => m.linkedToMemberId === currentMember.id && m.isKeiki)
      .map((m) => m.id);
  }, [isGuardian, currentMember, members]);
  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Accent colors for financial functions
  const accentColors = {
    primary: theme.primary,
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    blue: '#3B82F6',
  };

  // Computed data
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
      // For students, get their dues
      const myDues = getMemberDuesByMember(currentMember.id);
      // For guardians, also include their keiki's dues
      if (isGuardian && myKeikiIds.length > 0) {
        const keikiDues = myKeikiIds.flatMap((keikiId) => getMemberDuesByMember(keikiId));
        dues = [...myDues, ...keikiDues];
      } else {
        dues = myDues;
      }
    }

    // Sort order: Past Due -> Due in 5 days -> Other unpaid by date -> Paid at end
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Calculate 5 days from now for "due soon" threshold
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const fiveDaysFromNowStr = fiveDaysFromNow.toISOString().split('T')[0];

    return dues.sort((a, b) => {
      // Paid items always go to the end
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      if (a.status !== 'paid' && b.status === 'paid') return -1;
      if (a.status === 'paid' && b.status === 'paid') {
        // Sort paid items by paid date (most recent first)
        return (b.paidAt || b.dueDate || '').localeCompare(a.paidAt || a.dueDate || '');
      }

      // For unpaid items, determine category
      const aIsPastDue = a.dueDate < todayStr;
      const bIsPastDue = b.dueDate < todayStr;
      const aIsDueSoon = !aIsPastDue && a.dueDate <= fiveDaysFromNowStr;
      const bIsDueSoon = !bIsPastDue && b.dueDate <= fiveDaysFromNowStr;

      // Past due items come first
      if (aIsPastDue && !bIsPastDue) return -1;
      if (!aIsPastDue && bIsPastDue) return 1;

      // If both past due, sort by date (oldest first - most overdue)
      if (aIsPastDue && bIsPastDue) {
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      }

      // Due soon (within 5 days) comes next
      if (aIsDueSoon && !bIsDueSoon) return -1;
      if (!aIsDueSoon && bIsDueSoon) return 1;

      // If both due soon or both future, sort by date (soonest first)
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    });
  }, [currentHalauId, currentMember, isAdmin, isGuardian, myKeikiIds, getMemberDuesByHalau, getMemberDuesByMember, memberDuesStore]);

  // Find the most recent upcoming due (not yet paid) for highlighting
  const mostRecentDueId = useMemo(() => {
    if (isAdmin) return null; // Only for students/guardians
    const unpaidDues = memberDues.filter((d) => d.status !== 'paid');
    if (unpaidDues.length === 0) return null;

    const today = new Date().toISOString().split('T')[0];
    // Sort by due date ascending to find the most immediate upcoming due
    const sortedByDate = [...unpaidDues].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // Find the first due that hasn't passed, or if all passed, the most recent overdue
    const upcomingDue = sortedByDate.find((d) => d.dueDate >= today);
    return upcomingDue?.id || sortedByDate[sortedByDate.length - 1]?.id || null;
  }, [isAdmin, memberDues]);

  const overdueDues = useMemo(() => {
    if (!currentHalauId) return [];
    return getOverdueMemberDues(currentHalauId);
  }, [currentHalauId, getOverdueMemberDues, memberDuesStore]);

  // Group dues by member for admin view — only unpaid/partial
  const studentDueGroups = useMemo(() => {
    if (!isAdmin) return [];
    const today = new Date().toISOString().split('T')[0];

    // Include all non-paid dues
    const activeDues = memberDues.filter((d) => d.status !== 'paid');

    // Group by memberId
    const grouped = new Map<string, typeof activeDues>();
    for (const due of activeDues) {
      const existing = grouped.get(due.memberId) ?? [];
      existing.push(due);
      grouped.set(due.memberId, existing);
    }

    // Build sorted array of groups
    const groups = Array.from(grouped.entries()).map(([memberId, dues]) => {
      const totalRemaining = dues.reduce((sum, d) => sum + (d.amount - d.amountPaid), 0);
      const hasOverdue = dues.some((d) => d.dueDate < today);
      // Sort dues within group: overdue first, then upcoming by date
      const sortedDues = [...dues].sort((a, b) => {
        const aOverdue = a.dueDate < today;
        const bOverdue = b.dueDate < today;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      });
      return { memberId, dues: sortedDues, totalRemaining, hasOverdue };
    });

    // Sort groups: groups with overdue first, then by member name
    const sorted = groups.sort((a, b) => {
      if (a.hasOverdue && !b.hasOverdue) return -1;
      if (!a.hasOverdue && b.hasOverdue) return 1;
      return getMemberName(a.memberId).localeCompare(getMemberName(b.memberId));
    });

    // Apply member filter if one is selected
    if (selectedMemberId) {
      return sorted.filter((g) => g.memberId === selectedMemberId);
    }
    return sorted;
  }, [isAdmin, memberDues, memberDuesStore, selectedMemberId]);

  // Members available for filtering (all halau members with activity)
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

  const toggleStudent = useCallback((memberId: string) => {    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }, []);

  const pendingExpenses = useMemo(() => {
    if (!currentHalauId) return [];
    return getPendingApprovalExpenses(currentHalauId);
  }, [currentHalauId, getPendingApprovalExpenses]);

  // ── AI Insights ──────────────────────────────────────────────────────────────
  // Computed entirely from existing store data — no new backend calls.
  const aiInsights = useMemo(() => {
    if (!isAdmin || !currentHalauId) return [];
    const today = new Date().toISOString().split('T')[0];
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const thirtyStr = thirtyDays.toISOString().split('T')[0];
    const results: Array<{ id: string; text: string; sub: string; accent: string; tab: TabType }> = [];

    // At-risk members
    const atRiskCount = studentDueGroups.filter(g => g.hasOverdue).length;
    if (atRiskCount > 0) {
      results.push({
        id: 'at_risk',
        text: `${atRiskCount} member${atRiskCount > 1 ? 's' : ''} overdue`,
        sub: 'Tap to view',
        accent: '#EF4444',
        tab: 'dues',
      });
    }

    // Expected income next 30 days
    const expectedIncome = memberDues
      .filter(d => d.status !== 'paid' && d.dueDate >= today && d.dueDate <= thirtyStr)
      .reduce((sum, d) => sum + (d.amount - d.amountPaid), 0);
    if (expectedIncome > 0) {
      results.push({
        id: 'expected',
        text: `${formatCurrency(expectedIncome)} expected`,
        sub: 'Next 30 days',
        accent: '#10B981',
        tab: 'dues',
      });
    }

    // Pending reimbursements
    if (pendingExpenses.length > 0) {
      results.push({
        id: 'expenses',
        text: `${pendingExpenses.length} expense${pendingExpenses.length > 1 ? 's' : ''} pending`,
        sub: 'Awaiting approval',
        accent: '#F59E0B',
        tab: 'expenses',
      });
    }

    // Collection rate
    const totalAmt = memberDues.reduce((s, d) => s + d.amount, 0);
    const totalPaidAmt = memberDues.reduce((s, d) => s + d.amountPaid, 0);
    if (totalAmt > 0) {
      const rate = Math.round((totalPaidAmt / totalAmt) * 100);
      results.push({
        id: 'rate',
        text: `${rate}% collection rate`,
        sub: rate >= 80 ? 'On track' : rate >= 50 ? 'Needs attention' : 'Action required',
        accent: rate >= 80 ? '#10B981' : rate >= 50 ? '#F59E0B' : '#EF4444',
        tab: 'dues',
      });
    }

    return results.slice(0, 5);
  }, [isAdmin, currentHalauId, studentDueGroups, memberDues, pendingExpenses, memberDuesStore]);

  // Header insight — single most important signal
  const headerInsight = useMemo(() => {
    if (!isAdmin) return null;
    const atRisk = studentDueGroups.filter(g => g.hasOverdue).length;
    if (atRisk > 0) return `${atRisk} member${atRisk > 1 ? 's' : ''} overdue — review dues`;
    const totalAmt = memberDues.reduce((s, d) => s + d.amount, 0);
    const totalPaidAmt = memberDues.reduce((s, d) => s + d.amountPaid, 0);
    if (totalAmt > 0) {
      const rate = Math.round((totalPaidAmt / totalAmt) * 100);
      if (rate >= 80) return `${rate}% collection rate — looking strong`;
      return `${rate}% collection rate — ${100 - rate}% still outstanding`;
    }
    return null;
  }, [isAdmin, studentDueGroups, memberDues, memberDuesStore]);

  // Quick-filter view of studentDueGroups (applied on top of member filter)
  const filteredGroups = useMemo(() => {
    if (!quickFilter || quickFilter === 'recently_paid') return studentDueGroups;
    if (quickFilter === 'at_risk' || quickFilter === 'overdue') {
      return studentDueGroups.filter(g => g.hasOverdue);
    }
    if (quickFilter === 'high_balance') {
      const avg = studentDueGroups.reduce((s, g) => s + g.totalRemaining, 0) / (studentDueGroups.length || 1);
      return studentDueGroups.filter(g => g.totalRemaining >= avg);
    }
    return studentDueGroups;
  }, [studentDueGroups, quickFilter]);

  // Member reliability badges for History tab — visual signals only, no new API calls
  const memberBadgeMap = useMemo(() => {
    if (!isAdmin) return new Map<string, { label: string; color: string }>();
    const map = new Map<string, { label: string; color: string }>();
    const memberIds = [...new Set(studentDueGroups.map(g => g.memberId))];
    for (const memberId of memberIds) {
      const group = studentDueGroups.find(g => g.memberId === memberId);
      if (!group) continue;
      const memberDuesList = memberDues.filter(d => d.memberId === memberId);
      const paid = memberDuesList.filter(d => d.status === 'paid').length;
      if (group.hasOverdue) {
        map.set(memberId, { label: 'Late payer', color: '#F59E0B' });
      } else if (memberDuesList.length > 0 && paid === memberDuesList.length) {
        map.set(memberId, { label: 'High reliability', color: '#10B981' });
      }
    }
    return map;
  }, [isAdmin, studentDueGroups, memberDues]);

  const expenses = useMemo(() => {
    if (!currentHalauId || !currentMember) return [];
    let result;
    if (isAdmin) {
      result = getOverdueExpensesByHalau(currentHalauId);
    } else {
      result = getOverdueExpensesByMember(currentMember.id);
    }
    if (isAdmin && selectedMemberId) {
      result = result.filter((e) => e.memberId === selectedMemberId);
    }
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
    if (isAdmin && selectedMemberId) {
      result = result.filter((t) => t.memberId === selectedMemberId);
    }
    return result.slice(0, 20);
  }, [currentHalauId, currentMember, isAdmin, selectedMemberId, getTransactionsByHalau, getTransactionsByMember, financialTransactionsStore]);

  const avgTransactionAmount = useMemo(() => {
    if (transactions.length === 0) return 0;
    return transactions.reduce((s, t) => s + t.amount, 0) / transactions.length;
  }, [transactions]);

  // Pending payment submissions (students submitting payments for admin confirmation)
  const pendingPayments = useMemo(() => {
    if (!currentHalauId || !isAdmin) return [];
    return getPendingPaymentSubmissions(currentHalauId);
  }, [currentHalauId, isAdmin, getPendingPaymentSubmissions, pendingPaymentSubmissionsStore]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getMemberName = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null || isNaN(amount)) return '$0.00';
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getDueName = (memberDueId: string) => {
    const due = memberDuesStore.find((d) => d.id === memberDueId);
    return due?.name || 'Unknown Due';
  };

  const handleConfirmPayment = (submissionId: string) => {
    const submission = pendingPayments.find((s) => s.id === submissionId);
    if (!submission) return;

    // Integrity check: an admin cannot approve their own payment
    if (
      currentMember?.role === 'admin' &&
      submission.memberId === currentMember.id
    ) {
      Alert.alert(
        'Action Not Allowed',
        'You cannot approve your own payment. Another admin or teacher must review and approve payments assigned to you.',
        [{ text: 'OK' }]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/financials/record-payment?submissionId=${submissionId}` as never);
  };

  const handleRejectPayment = (submissionId: string) => {
    const submission = pendingPayments.find((s) => s.id === submissionId);
    if (!submission) return;

    // Integrity check: an admin cannot reject their own payment
    if (
      currentMember?.role === 'admin' &&
      submission.memberId === currentMember.id
    ) {
      Alert.alert(
        'Action Not Allowed',
        'You cannot reject your own payment submission. Another admin or teacher must review it.',
        [{ text: 'OK' }]
      );
      return;
    }

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
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              // Auto-refresh happens via store update - no extra popup needed
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

  // Card shadow style
  const cardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.5 : 0.18,
    shadowRadius: 12,
    elevation: 10,
  };

  const lightCardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 8,
    elevation: 6,
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
          {/* Top Bar */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <BackButton
              color="#FFFFFF"
              onPress={() => {
                router.replace('/(tabs)');
              }}
            />

            <Text className="text-white text-xl font-bold">Financials</Text>

            <View className="w-10" />
          </View>

          {/* Summary Cards - Admin Only */}
          {isAdmin && (
            <View className="flex-row px-4 gap-2 pb-1">
              <SafeAnimatedView entering={FadeInDown.delay(100).duration(400)} className="flex-1">
                <View className="bg-white/15 backdrop-blur-sm rounded-2xl px-2 py-3 border border-white/10 relative items-center">
                  <View className="w-7 h-7 rounded-full bg-amber-400/30 items-center justify-center mb-1.5">
                    <Clock size={14} color="#fcd34d" />
                  </View>
                  <Text className="text-amber-200 text-[10px] font-medium mb-1" numberOfLines={1}>Pending</Text>
                  <Text
                    className="text-white font-bold text-center"
                    style={{ fontSize: 14 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatCurrency(financialSummary.totalPending)}
                  </Text>
                  {/* Notification Badge for pending payments */}
                  {pendingPayments.length > 0 && (
                    <View className="absolute -top-2 -right-2 bg-red-500 rounded-full min-w-[20px] h-[20px] items-center justify-center px-1">
                      <Text className="text-white text-[10px] font-bold">{pendingPayments.length}</Text>
                    </View>
                  )}
                </View>
              </SafeAnimatedView>

              <SafeAnimatedView entering={FadeInDown.delay(150).duration(400)} className="flex-1">
                <View className="bg-white/15 backdrop-blur-sm rounded-2xl px-2 py-3 border border-white/10 items-center">
                  <View className="w-7 h-7 rounded-full bg-red-400/30 items-center justify-center mb-1.5">
                    <AlertCircle size={14} color="#fca5a5" />
                  </View>
                  <Text className="text-red-200 text-[10px] font-medium mb-1" numberOfLines={1}>Overdue</Text>
                  <Text
                    className="text-white font-bold text-center"
                    style={{ fontSize: 14 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatCurrency(financialSummary.totalOverdue)}
                  </Text>
                </View>
              </SafeAnimatedView>

              <SafeAnimatedView entering={FadeInDown.delay(200).duration(400)} className="flex-1">
                <View className="bg-white/15 backdrop-blur-sm rounded-2xl px-2 py-3 border border-white/10 items-center">
                  <View className="w-7 h-7 rounded-full bg-purple-400/30 items-center justify-center mb-1.5">
                    <TrendingDown size={14} color="#c4b5fd" />
                  </View>
                  <Text className="text-purple-200 text-[10px] font-medium mb-1" numberOfLines={1}>Disburse</Text>
                  <Text
                    className="text-white font-bold text-center"
                    style={{ fontSize: 14 }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {formatCurrency(financialSummary.totalOwedToMembers)}
                  </Text>
                </View>
              </SafeAnimatedView>
            </View>
          )}

          {/* AI Header Insight */}
          {isAdmin && headerInsight && (
            <View className="flex-row items-center px-5 pt-2.5 pb-1">
              <Sparkles size={11} color="rgba(255,255,255,0.6)" />
              <Text className="text-white/60 text-[11px] ml-1.5 flex-1" numberOfLines={1}>{headerInsight}</Text>
            </View>
          )}
        </LinearGradient>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Quick Actions Section */}
        <View className="px-5 pt-5">
          {isAdmin ? (
            <SafeAnimatedView entering={FadeIn.delay(100).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Quick Actions
              </Text>

              {/* Record Payment — primary full-width action */}
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/financials/record-payment');
                }}
                className={cn(
                  'rounded-2xl border flex-row items-center px-4 py-3.5 mb-3',
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                )}
                style={cardShadow}
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: `${accentColors.success}20` }}
                >
                  <CircleDollarSign size={22} color={accentColors.success} />
                </View>
                <View className="flex-1">
                  <Text className={cn('font-bold text-[16px]', isDark ? 'text-white' : 'text-slate-900')}>
                    Record Payment
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Sparkles size={10} color={accentColors.success} />
                    <Text className={cn('text-[11px] ml-1', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                      Smart suggestions available
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </AnimatedPressable>

              {/* Set Up Dues + Export — secondary row */}
              <View className="flex-row" style={{ gap: 12 }}>
                <AnimatedPressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/financials/manage-dues');
                  }}
                  className={cn(
                    'rounded-2xl border items-center justify-center p-4',
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  )}
                  containerStyle={{ flex: 1 }}
                  style={cardShadow}
                >
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mb-2"
                    style={{ backgroundColor: `${accentColors.primary}15` }}
                  >
                    <Settings size={16} color={accentColors.primary} />
                  </View>
                  <Text className={cn('font-bold text-base text-center mb-0.5', isDark ? 'text-white' : 'text-slate-900')}>
                    Set Up
                  </Text>
                  <Text className={cn('text-[11px] text-center', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Dues
                  </Text>
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/financials/export');
                  }}
                  className={cn(
                    'rounded-2xl border items-center justify-center p-4',
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                  )}
                  containerStyle={{ flex: 1 }}
                  style={cardShadow}
                >
                  <View
                    className="w-8 h-8 rounded-full items-center justify-center mb-2"
                    style={{ backgroundColor: `${accentColors.blue}15` }}
                  >
                    <Download size={16} color={accentColors.blue} />
                  </View>
                  <Text className={cn('font-bold text-base text-center mb-0.5', isDark ? 'text-white' : 'text-slate-900')}>
                    Export
                  </Text>
                  <Text className={cn('text-[11px] text-center', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    Data
                  </Text>
                </AnimatedPressable>
              </View>
            </SafeAnimatedView>
          ) : (
            <SafeAnimatedView entering={FadeIn.delay(100).duration(400)}>
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Quick Actions
              </Text>
              <AnimatedPressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/financials/request-reimbursement');
                }}
                className={cn(
                  'p-4 rounded-2xl flex-row items-center border',
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                )}
                style={cardShadow}
              >
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: `${accentColors.purple}15` }}
                >
                  <Send size={20} color={accentColors.purple} />
                </View>
                <View className="flex-1">
                  <Text className={cn('font-semibold text-[15px]', isDark ? 'text-white' : 'text-slate-900')}>
                    Request Reimbursement
                  </Text>
                  <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
                    Submit an expense for approval
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? '#64748B' : '#94A3B8'} />
              </AnimatedPressable>
            </SafeAnimatedView>
          )}
        </View>

        {/* AI Insights Strip — admin only, max 5 cards */}
        {isAdmin && aiInsights.length > 0 && (
          <SafeAnimatedView entering={FadeIn.delay(150).duration(400)}>
            <View className="mt-5">
              <View className="flex-row items-center px-5 mb-2.5">
                <Sparkles size={12} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text className={cn('text-xs font-semibold uppercase tracking-wider ml-1.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  AI Insights
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
                style={{ flexGrow: 0 }}
              >
                {aiInsights.map((insight) => (
                  <Pressable
                    key={insight.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab(insight.tab);
                    }}
                    className={cn(
                      'rounded-2xl border px-4 py-3',
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                    )}
                    style={{ minWidth: 140 }}
                  >
                    <View className="w-2 h-2 rounded-full mb-2" style={{ backgroundColor: insight.accent }} />
                    <Text className={cn('font-semibold text-[13px]', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>
                      {insight.text}
                    </Text>
                    <Text className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} numberOfLines={1}>
                      {insight.sub}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </SafeAnimatedView>
        )}

        {/* Pending Approvals Alert - Admin Only */}
        {isAdmin && pendingExpenses.length > 0 && (
          <View className="px-5 mt-5">
            <SafeAnimatedView entering={FadeIn.delay(200).duration(400)}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab('expenses');
                }}
                className={cn(
                  'p-4 rounded-2xl flex-row items-center border',
                  isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'
                )}
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
            </SafeAnimatedView>
          </View>
        )}

        {/* Confirm Payments Section - Admin Only */}
        {isAdmin && pendingPayments.length > 0 && (
          <View className="px-5 mt-5">
            <SafeAnimatedView entering={FadeIn.delay(250).duration(400)}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className={cn('text-xs font-semibold uppercase tracking-wider', isDark ? 'text-emerald-400' : 'text-emerald-600')}>
                  Confirm Payments
                </Text>
                <View className="bg-emerald-500 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-xs font-bold">{pendingPayments.length}</Text>
                </View>
              </View>

              <View className="gap-3">
                {pendingPayments.map((submission, index) => {
                  const isSelfPayment = currentMember?.role === 'admin' && submission.memberId === currentMember.id;
                  return (
                  <SafeAnimatedView
                    key={submission.id}
                    entering={FadeInUp.delay(index * 50).duration(300)}
                  >
                    <View
                      className={cn(
                        'p-4 rounded-2xl border',
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                      )}
                      style={lightCardShadow}
                    >
                      {/* Self-payment integrity notice */}
                      {isSelfPayment && (
                        <View className={cn('flex-row items-center p-2.5 rounded-xl mb-3', isDark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-50 border border-orange-200')}>
                          <AlertCircle size={13} color="#F97316" />
                          <Text className={cn('text-xs ml-1.5 flex-1 font-medium', isDark ? 'text-orange-300' : 'text-orange-700')}>
                            Requires another admin or teacher to approve
                          </Text>
                        </View>
                      )}
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="flex-1 mr-3">
                          <Text className={cn('font-semibold text-[15px]', isDark ? 'text-white' : 'text-slate-900')}>
                            {getMemberName(submission.memberId)}
                          </Text>
                          <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                            {getDueName(submission.memberDueId)}
                          </Text>
                        </View>
                        <View className="items-end">
                          <Text className={cn('font-bold text-base', 'text-emerald-500')}>
                            {formatCurrency(submission.amount)}
                          </Text>
                          <View className="flex-row items-center mt-1">
                            <Text className={cn('text-xs capitalize', isDark ? 'text-slate-500' : 'text-slate-400')}>
                              via {submission.method}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View className={cn('pt-3 border-t flex-row gap-2', isDark ? 'border-slate-800' : 'border-slate-100')}>
                        <Pressable
                          onPress={() => handleRejectPayment(submission.id)}
                          style={{ opacity: isSelfPayment ? 0.4 : 1 }}
                          className={cn(
                            'flex-1 py-2.5 rounded-xl flex-row items-center justify-center',
                            isDark ? 'bg-red-500/10' : 'bg-red-50'
                          )}
                        >
                          <X size={16} color="#EF4444" />
                          <Text className="text-red-500 font-semibold text-sm ml-1.5">Reject</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleConfirmPayment(submission.id)}
                          style={{ opacity: isSelfPayment ? 0.4 : 1 }}
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
                  </SafeAnimatedView>
                  );
                })}
              </View>
            </SafeAnimatedView>
          </View>
        )}

        {/* Separator */}
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
              <Search size={15} color={isDark ? '#94A3B8' : '#94A3B8'} />
              <Text
                className={cn(
                  'flex-1 ml-2 text-[14px]',
                  selectedMemberId
                    ? (isDark ? 'text-white' : 'text-slate-900')
                    : (isDark ? 'text-slate-500' : 'text-slate-400')
                )}
              >
                {selectedMemberId
                  ? getMemberName(selectedMemberId)
                  : 'All members'}
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
                  <X size={15} color={isDark ? '#94A3B8' : '#94A3B8'} />
                </Pressable>
              ) : (
                <ChevronDown size={15} color={isDark ? '#94A3B8' : '#94A3B8'} />
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
                {/* Search input inside dropdown */}
                <View className={cn('flex-row items-center px-3 py-2 border-b', isDark ? 'border-slate-800' : 'border-slate-100')}>
                  <Search size={14} color={isDark ? '#94A3B8' : '#94A3B8'} />
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
                      <X size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                    </Pressable>
                  )}
                </View>

                <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 210 }}>
                  {/* "All members" option */}
                  <Pressable
                    onPress={() => {
                      setSelectedMemberId(null);
                      setShowMemberDropdown(false);
                      setMemberSearch('');
                    }}
                    className={cn(
                      'flex-row items-center px-3 py-2.5',
                      !selectedMemberId && (isDark ? 'bg-slate-800' : 'bg-slate-50')
                    )}
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
                      className={cn(
                        'flex-row items-center px-3 py-2.5',
                        selectedMemberId === m.id && (isDark ? 'bg-slate-800' : 'bg-slate-50')
                      )}
                    >
                      <Text className={cn('text-[14px]', selectedMemberId === m.id ? (isDark ? 'text-white font-semibold' : 'text-slate-900 font-semibold') : (isDark ? 'text-slate-300' : 'text-slate-700'))}>
                        {m.firstName} {m.lastName}
                      </Text>
                      {m.role === 'student' && (
                        <Text className={cn('ml-2 text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                          student
                        </Text>
                      )}
                    </Pressable>
                  ))}

                  {filteredMemberOptions.length === 0 && (
                    <View className="px-3 py-4 items-center">
                      <Text className={cn('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        No members found
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Tab Bar */}
        <View className="px-5 mb-4">
          <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
            Browse
          </Text>
          <View className="flex-row gap-2">
            {TABS.map((tab) => (
              <AnimatedPressable
                key={tab.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.id);
                }}
                className={cn(
                  'flex-1 flex-row items-center justify-center px-4 py-3 rounded-xl border',
                  activeTab === tab.id
                    ? ''
                    : isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                )}
                style={[
                  activeTab === tab.id
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : lightCardShadow,
                ]}
              >
                <tab.icon
                  size={16}
                  color={activeTab === tab.id ? '#FFFFFF' : isDark ? '#64748B' : '#94A3B8'}
                />
                <Text
                  className={cn(
                    'ml-2 font-semibold text-[13px]',
                    activeTab === tab.id
                      ? 'text-white'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-600'
                  )}
                >
                  {tab.label}
                </Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-5">
          {/* Dues Tab */}
          {activeTab === 'dues' && (
            <View>
              {/* Quick Filter Chips — admin only */}
              {isAdmin && studentDueGroups.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                  style={{ flexGrow: 0, marginBottom: 4 }}
                >
                  {(
                    [
                      { id: 'at_risk', label: '⚠ At Risk' },
                      { id: 'overdue', label: 'Overdue' },
                      { id: 'high_balance', label: 'High Balance' },
                      { id: 'recently_paid', label: 'Recently Paid' },
                    ] as { id: typeof quickFilter; label: string }[]
                  ).map((chip) => (
                    <Pressable
                      key={chip.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setQuickFilter((prev) => (prev === chip.id ? null : chip.id));
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-full border',
                        quickFilter === chip.id
                          ? ''
                          : isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      )}
                      style={quickFilter === chip.id ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                    >
                      <Text
                        className={cn(
                          'text-[12px] font-semibold',
                          quickFilter === chip.id ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-600'
                        )}
                      >
                        {chip.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              {/* Admin: grouped by student */}
              {isAdmin ? (
                filteredGroups.length === 0 ? (
                  <SafeAnimatedView
                    entering={FadeIn.duration(400)}
                    className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                    style={lightCardShadow}
                  >
                    <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <FileText size={28} color={isDark ? '#475569' : '#94A3B8'} />
                    </View>
                    <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      No outstanding dues
                    </Text>
                    <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>
                      All students are paid up!
                    </Text>
                  </SafeAnimatedView>
                ) : (
                  filteredGroups.map((group, index) => {
                    const isExpanded = expandedStudents.has(group.memberId);
                    const today = new Date().toISOString().split('T')[0];

                    return (
                      <SafeAnimatedView
                        key={group.memberId}
                        entering={FadeInUp.delay(index * 40).duration(300)}
                        className="mb-2"
                      >
                        <View
                          className={cn(
                            'rounded-2xl overflow-hidden border',
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100',
                            group.hasOverdue && (isDark ? 'border-red-900/60' : 'border-red-100')
                          )}
                          style={lightCardShadow}
                        >
                          {/* Student row — tap to expand */}
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              toggleStudent(group.memberId);
                            }}
                            className={cn(
                              'px-4 py-3.5 flex-row items-center',
                              group.hasOverdue && (isDark ? 'bg-red-500/5' : 'bg-red-50/60')
                            )}
                          >
                            {/* Avatar */}
                            <View
                              className={cn(
                                'w-9 h-9 rounded-full items-center justify-center mr-3',
                                group.hasOverdue
                                  ? 'bg-red-500/15'
                                  : isDark ? 'bg-slate-700' : 'bg-slate-100'
                              )}
                            >
                              <User
                                size={16}
                                color={group.hasOverdue ? '#EF4444' : isDark ? '#94A3B8' : '#64748B'}
                              />
                            </View>

                            {/* Name + badge */}
                            <View className="flex-1 mr-2">
                              <Text
                                className={cn('font-semibold text-[15px]', isDark ? 'text-white' : 'text-slate-900')}
                                numberOfLines={1}
                              >
                                {getMemberName(group.memberId)}
                              </Text>
                              <View className="flex-row items-center flex-wrap gap-1 mt-0.5">
                                <Text className={cn('text-[11px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                  {group.dues.length} due{group.dues.length !== 1 ? 's' : ''}
                                </Text>
                                {group.hasOverdue && (
                                  <View className="flex-row items-center px-1.5 py-0.5 rounded-full bg-red-500/15">
                                    <AlertCircle size={9} color="#EF4444" />
                                    <Text className="text-[10px] text-red-500 font-semibold ml-0.5">Overdue</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            {/* Total + chevron */}
                            <View className="items-end mr-2">
                              <Text
                                className={cn(
                                  'font-bold text-[16px]',
                                  group.hasOverdue ? 'text-red-500' : isDark ? 'text-emerald-400' : 'text-emerald-600'
                                )}
                              >
                                {formatCurrency(group.totalRemaining)}
                              </Text>
                              <Text className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>
                                remaining
                              </Text>
                            </View>

                            <SafeAnimatedView
                              style={{
                                transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                              }}
                            >
                              <ChevronDown size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                            </SafeAnimatedView>
                          </Pressable>

                          {/* Expanded: individual dues */}
                          {isExpanded && (
                            <View
                              className={cn(
                                'border-t',
                                isDark ? 'border-slate-800' : 'border-slate-100'
                              )}
                            >
                              {group.dues.map((due, dueIndex) => {
                                const isPastDue = due.dueDate < today;
                                const fiveDays = new Date();
                                fiveDays.setDate(fiveDays.getDate() + 5);
                                const isDueSoon = !isPastDue && due.dueDate <= fiveDays.toISOString().split('T')[0];
                                const remaining = due.amount - due.amountPaid;

                                return (
                                  <Pressable
                                    key={due.id}
                                    onPress={() => {
                                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                      router.push(`/financials/due/${due.id}`);
                                    }}
                                    className={cn(
                                      'px-4 py-3 flex-row items-center active:opacity-80',
                                      dueIndex !== group.dues.length - 1 && (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'),
                                      isPastDue && (isDark ? 'bg-red-500/5' : 'bg-red-50/40')
                                    )}
                                  >
                                    {/* Color accent bar */}
                                    <View
                                      className="w-1 self-stretch rounded-full mr-3"
                                      style={{
                                        backgroundColor: isPastDue
                                          ? '#EF4444'
                                          : isDueSoon
                                          ? '#F59E0B'
                                          : theme.primary,
                                      }}
                                    />

                                    <View className="flex-1 mr-2">
                                      <Text
                                        className={cn(
                                          'font-medium text-[13px]',
                                          isPastDue
                                            ? 'text-red-500'
                                            : isDark ? 'text-slate-200' : 'text-slate-800'
                                        )}
                                        numberOfLines={1}
                                      >
                                        {due.name}
                                      </Text>
                                      <Text
                                        className={cn(
                                          'text-[11px] mt-0.5',
                                          isPastDue
                                            ? 'text-red-400'
                                            : isDueSoon
                                            ? 'text-amber-500'
                                            : isDark ? 'text-slate-500' : 'text-slate-400'
                                        )}
                                      >
                                        {isPastDue ? 'Was due ' : isDueSoon ? 'Due soon · ' : 'Due '}
                                        {formatDate(due.dueDate)}
                                      </Text>
                                    </View>

                                    <View className="items-end mr-2">
                                      <Text
                                        className={cn(
                                          'font-semibold text-[13px]',
                                          isPastDue ? 'text-red-500' : isDark ? 'text-white' : 'text-slate-900'
                                        )}
                                      >
                                        {formatCurrency(remaining)}
                                      </Text>
                                      {due.amountPaid > 0 && (
                                        <Text className={cn('text-[10px]', isDark ? 'text-slate-600' : 'text-slate-400')}>
                                          {formatCurrency(due.amountPaid)} paid
                                        </Text>
                                      )}
                                    </View>

                                    <ChevronRight size={14} color={isDark ? '#475569' : '#CBD5E1'} />
                                  </Pressable>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      </SafeAnimatedView>
                    );
                  })
                )
              ) : (
                /* Student/Guardian view: unchanged individual list */
                memberDues.length === 0 ? (
                  <SafeAnimatedView
                    entering={FadeIn.duration(400)}
                    className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                    style={lightCardShadow}
                  >
                    <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <FileText size={28} color={isDark ? '#475569' : '#94A3B8'} />
                    </View>
                    <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      No dues found
                    </Text>
                    <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>
                      You're all caught up!
                    </Text>
                  </SafeAnimatedView>
                ) : (
                  memberDues.map((due, index) => {
                    const isMostRecentDue = due.id === mostRecentDueId;
                    const today = new Date().toISOString().split('T')[0];
                    const fiveDaysFromNow = new Date();
                    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
                    const fiveDaysFromNowStr = fiveDaysFromNow.toISOString().split('T')[0];

                    const isPastDue = due.status !== 'paid' && due.dueDate < today;
                    const isDueSoon = due.status !== 'paid' && !isPastDue && due.dueDate <= fiveDaysFromNowStr;

                    const displayStatus = due.status === 'paid'
                      ? 'paid'
                      : isPastDue
                      ? 'past due'
                      : isDueSoon
                      ? 'due soon'
                      : 'pending';

                    return (
                      <SafeAnimatedView
                        key={due.id}
                        entering={FadeInUp.delay(index * 50).duration(300)}
                      >
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/financials/dues/${due.id}`);
                          }}
                          className={cn(
                            'px-3 py-2.5 rounded-xl mb-2 border active:opacity-90',
                            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                          )}
                          style={[
                            lightCardShadow,
                            isMostRecentDue && {
                              borderLeftWidth: 4,
                              borderLeftColor: theme.primary,
                              backgroundColor: isDark ? `${theme.primary}15` : `${theme.primary}08`,
                            },
                            isPastDue && {
                              borderLeftWidth: 4,
                              borderLeftColor: '#EF4444',
                              backgroundColor: isDark ? '#EF444415' : '#FEF2F2',
                            },
                            isDueSoon && !isMostRecentDue && {
                              borderLeftWidth: 4,
                              borderLeftColor: '#F59E0B',
                              backgroundColor: isDark ? '#F59E0B15' : '#FFFBEB',
                            },
                          ]}
                        >
                          <View className="flex-row items-center">
                            <View className="flex-1 mr-2">
                              <View className="flex-row items-center">
                                <Text className={cn('font-semibold text-[14px] flex-1', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>
                                  {due.name}
                                </Text>
                                <View
                                  className={cn(
                                    'px-1.5 py-0.5 rounded ml-2',
                                    displayStatus === 'paid'
                                      ? 'bg-emerald-500/15'
                                      : displayStatus === 'past due'
                                      ? 'bg-red-500/15'
                                      : displayStatus === 'due soon'
                                      ? 'bg-amber-500/15'
                                      : isDark ? 'bg-slate-800' : 'bg-slate-100'
                                  )}
                                >
                                  <Text
                                    className={cn(
                                      'text-[10px] font-semibold uppercase',
                                      displayStatus === 'paid'
                                        ? 'text-emerald-600'
                                        : displayStatus === 'past due'
                                        ? 'text-red-500'
                                        : displayStatus === 'due soon'
                                        ? 'text-amber-600'
                                        : isDark ? 'text-slate-400' : 'text-slate-500'
                                    )}
                                  >
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

                          <View className={cn('h-1 rounded-full overflow-hidden mt-2', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <SafeAnimatedView
                              className="h-1 rounded-full"
                              style={{
                                width: `${due.amount > 0 ? Math.min((due.amountPaid / due.amount) * 100, 100) : 0}%`,
                                backgroundColor: due.status === 'paid' ? accentColors.success : isPastDue ? '#EF4444' : theme.primary,
                              }}
                            />
                          </View>
                        </Pressable>
                      </SafeAnimatedView>
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
                <SafeAnimatedView
                  entering={FadeIn.duration(400)}
                  className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={lightCardShadow}
                >
                  <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <Wallet size={28} color={isDark ? '#475569' : '#94A3B8'} />
                  </View>
                  <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    No expenses found
                  </Text>
                  <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>
                    {isAdmin ? 'No reimbursement requests yet' : 'Submit a request to get started'}
                  </Text>
                </SafeAnimatedView>
              ) : (
                <>
                  {/* Pending Expenses Section for Admin */}
                  {isAdmin && pendingExpenses.length > 0 && (
                    <View className="mb-3">
                      <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2', isDark ? 'text-amber-400' : 'text-amber-600')}>
                        Awaiting Approval
                      </Text>
                      {pendingExpenses.map((expense, index) => (
                        <SafeAnimatedView
                          key={expense.id}
                          entering={FadeInUp.delay(index * 50).duration(300)}
                        >
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              router.push(`/financials/expense/${expense.id}`);
                            }}
                            className={cn(
                              'px-3 py-2.5 rounded-xl mb-2 border-l-4 border-amber-500 active:opacity-90',
                              isDark ? 'bg-slate-900' : 'bg-white'
                            )}
                            style={lightCardShadow}
                          >
                            <View className="flex-row items-center">
                              <View className="flex-1 mr-2">
                                <Text className={cn('font-semibold text-[14px]', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>
                                  {expense.description}
                                </Text>
                                <Text className={cn('text-[11px] mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')} numberOfLines={1}>
                                  {getMemberName(expense.memberId)} · {formatDate(expense.requestedAt)}
                                </Text>
                              </View>
                              <Text className="text-amber-500 font-bold text-[13px]">
                                {formatCurrency(expense.amount)}
                              </Text>
                              <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                            </View>
                          </Pressable>
                        </SafeAnimatedView>
                      ))}
                    </View>
                  )}

                  {/* Other Expenses */}
                  {expenses.length > 0 && (
                    <>
                      {isAdmin && pendingExpenses.length > 0 && (
                        <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2', isDark ? 'text-slate-500' : 'text-slate-400')}>
                          All Expenses
                        </Text>
                      )}
                      {expenses.map((expense, index) => (
                        <SafeAnimatedView
                          key={expense.id}
                          entering={FadeInUp.delay(index * 50).duration(300)}
                        >
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              router.push(`/financials/expense/${expense.id}`);
                            }}
                            className={cn(
                              'px-3 py-2.5 rounded-xl mb-2 border active:opacity-90',
                              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                            )}
                            style={lightCardShadow}
                          >
                            <View className="flex-row items-center">
                              <View className="flex-1 mr-2">
                                <View className="flex-row items-center">
                                  <Text className={cn('font-semibold text-[14px] flex-1', isDark ? 'text-white' : 'text-slate-900')} numberOfLines={1}>
                                    {expense.description}
                                  </Text>
                                  <View
                                    className={cn(
                                      'px-1.5 py-0.5 rounded ml-2',
                                      expense.status === 'released'
                                        ? 'bg-emerald-500/15'
                                        : expense.status === 'approved'
                                        ? 'bg-blue-500/15'
                                        : expense.status === 'denied'
                                        ? 'bg-red-500/15'
                                        : 'bg-amber-500/15'
                                    )}
                                  >
                                    <Text
                                      className={cn(
                                        'text-[10px] font-semibold uppercase',
                                        expense.status === 'released'
                                          ? 'text-emerald-600'
                                          : expense.status === 'approved'
                                          ? 'text-blue-600'
                                          : expense.status === 'denied'
                                          ? 'text-red-500'
                                          : 'text-amber-600'
                                      )}
                                    >
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
                              <Text className={cn('font-bold text-[13px]', isDark ? 'text-white' : 'text-slate-900')}>
                                {formatCurrency(expense.amount)}
                              </Text>
                              <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                            </View>
                          </Pressable>
                        </SafeAnimatedView>
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
                <SafeAnimatedView
                  entering={FadeIn.duration(400)}
                  className={cn('p-8 rounded-2xl items-center border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={lightCardShadow}
                >
                  <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <Receipt size={28} color={isDark ? '#475569' : '#94A3B8'} />
                  </View>
                  <Text className={cn('font-semibold text-base', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    No transactions yet
                  </Text>
                  <Text className={cn('text-sm text-center mt-1', isDark ? 'text-slate-600' : 'text-slate-400')}>
                    Transactions will appear here
                  </Text>
                </SafeAnimatedView>
              ) : (
                <View
                  className={cn('rounded-xl overflow-hidden border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
                  style={lightCardShadow}
                >
                  {transactions.map((transaction, index) => (
                    <SafeAnimatedView
                      key={transaction.id}
                      entering={FadeInUp.delay(index * 30).duration(300)}
                    >
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push(`/financials/transaction/${transaction.id}`);
                        }}
                        className={cn(
                          'px-3 py-2.5 active:opacity-80',
                          index !== transactions.length - 1 && (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100')
                        )}
                      >
                        <View className="flex-row items-center">
                          <View
                            className={cn(
                              'w-8 h-8 rounded-lg items-center justify-center mr-2.5',
                              transaction.type === 'payment'
                                ? 'bg-emerald-500/15'
                                : transaction.type === 'refund'
                                ? 'bg-red-500/15'
                                : 'bg-purple-500/15'
                            )}
                          >
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
                              <Text className={cn('font-medium capitalize text-[14px]', isDark ? 'text-white' : 'text-slate-900')}>
                                {transaction.type.replace('_', ' ')}
                              </Text>
                              {transaction.method && (
                                <Text className={cn('text-[10px] capitalize ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                  via {transaction.method}
                                </Text>
                              )}
                            </View>
                            <View className="flex-row items-center flex-wrap gap-1 mt-0.5">
                              <Text className={cn('text-[11px]', isDark ? 'text-slate-500' : 'text-slate-400')}>
                                {isAdmin ? `${getMemberName(transaction.memberId)} · ` : ''}{formatDate(transaction.processedAt)}
                                {isAdmin && transaction.processedBy && ` · by ${getMemberName(transaction.processedBy)}`}
                              </Text>
                              {isAdmin && (() => {
                                const memberBadge = memberBadgeMap.get(transaction.memberId);
                                const isUnusual = avgTransactionAmount > 0 && transaction.amount > avgTransactionAmount * 2.5;
                                const badge = isUnusual ? { label: 'Unusual', color: '#94A3B8' } : memberBadge;
                                if (!badge) return null;
                                return (
                                  <View
                                    className="px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${badge.color}20` }}
                                  >
                                    <Text className="text-[9px] font-semibold" style={{ color: badge.color }}>
                                      {badge.label}
                                    </Text>
                                  </View>
                                );
                              })()}
                            </View>
                          </View>
                          <Text
                            className={cn(
                              'font-bold text-[13px]',
                              transaction.type === 'payment' ? 'text-emerald-500' : 'text-red-500'
                            )}
                          >
                            {transaction.type === 'payment' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </Text>
                          <ChevronRight size={16} color={isDark ? '#475569' : '#94A3B8'} style={{ marginLeft: 4 }} />
                        </View>
                      </Pressable>
                    </SafeAnimatedView>
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
