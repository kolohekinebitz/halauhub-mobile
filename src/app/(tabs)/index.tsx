import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import {
  Users,
  Calendar,
  UserPlus,
  CalendarPlus,
  ClipboardCheck,
  ChevronRight,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  MapPin,
  RefreshCw,
  Lock,
  Baby,
  LogOut,
  Filter,
  X,
  Check,
} from 'lucide-react-native';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore, useShallow } from '@/lib/store';
import { useSubscription } from '@/lib/useSubscription';
import { cn } from '@/lib/cn';
import { format, isToday, isTomorrow, parseISO, addMonths } from 'date-fns';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import TrialExpiredModal from '@/components/TrialExpiredModal';
import { useDeepMemo } from '@/lib/useDeepMemo';
import TrialReminderModal from '@/components/TrialReminderModal';
import { TrialStartModal } from '@/components/TrialStartModal';
import { DonationModal } from '@/components/DonationModal';

type DashboardEventFilter = 'all' | 'my_events' | 'practice' | 'performance' | 'meeting' | 'workshop' | 'other';

function DashboardContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dashboardEventFilter, setDashboardEventFilter] = useState<DashboardEventFilter>('all');
  const [showDashboardFilterModal, setShowDashboardFilterModal] = useState(false);

  // Trial modal state
  const { status: subscriptionStatus, isTeacherRole } = useSubscription();
  const trialStartDate = useAppStore((s) => s.trialStartDate);
  const hasAcknowledgedTrial = useAppStore((s) => s.hasAcknowledgedTrial);
  const shouldShowTrialReminder = useAppStore((s) => s.shouldShowTrialReminder);
  const markTrialReminderSeen = useAppStore((s) => s.markTrialReminderSeen);
  const acknowledgeTrialStart = useAppStore((s) => s.acknowledgeTrialStart);
  const getTrialDaysRemaining = useAppStore((s) => s.getTrialDaysRemaining);

  // Welcome popup — shown once per account, dismissed permanently
  const hasSeenWelcomePopup = useAppStore((s) => s.hasSeenWelcomePopup);
  const markWelcomePopupSeen = useAppStore((s) => s.markWelcomePopupSeen);
  const currentUserRole = useAppStore((s) => s.currentMember?.role ?? null);

  // Show TrialStartModal once when teacher first creates a school (persisted via store)
  const showTrialStart = isTeacherRole && subscriptionStatus === 'trialing' && !!trialStartDate && !hasAcknowledgedTrial;
  const showTrialReminder = isTeacherRole && subscriptionStatus === 'trialing' && shouldShowTrialReminder();
  const showTrialExpired = isTeacherRole && subscriptionStatus === 'expired';

  // Store selectors - primitives selected individually
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useDeepMemo(useAppStore((s) => s.currentMember));
  const currentUser = useDeepMemo(useAppStore((s) => s.currentUser));

  // Subscribe directly to events state for real-time updates
  const storeEvents = useAppStore((s) => s.events);

  // Subscribe to memberDues for financial summary updates
  const storeMemberDues = useAppStore((s) => s.memberDues);

  // Subscribe directly to members state for real-time badge updates
  const storeMembers = useAppStore((s) => s.members);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  // Subscribe to pendingPaymentSubmissions for real-time badge updates
  const storePendingPaymentSubmissions = useAppStore((s) => s.pendingPaymentSubmissions);

  // Subscribe to RSVPs for real-time event response updates
  const storeRsvps = useAppStore((s) => s.rsvps);

  // Store actions - grouped with useShallow to prevent re-renders
  const storeActions = useAppStore(useShallow((s) => ({
    getHalau: s.getHalau,
    getMembersByHalau: s.getMembersByHalau,
    getPendingMembers: s.getPendingMembers,
    getUpcomingEvents: s.getUpcomingEvents,
    isKumu: s.isKumu,
    getKeikiByGuardian: s.getKeikiByGuardian,
    getFinancialSummary: s.getFinancialSummary,
    getMemberDuesByMember: s.getMemberDuesByMember,
    getTitleSettings: s.getTitleSettings,
    signOut: s.signOut,
    getPendingPaymentSubmissions: s.getPendingPaymentSubmissions,
    getPendingApprovalExpenses: s.getPendingApprovalExpenses,
    getClassLevelsForHalau: s.getClassLevelsForHalau,
    getRSVPsByEvent: s.getRSVPsByEvent,
    getMemberRSVP: s.getMemberRSVP,
  })));

  const {
    getHalau,
    getMembersByHalau,
    getPendingMembers,
    getUpcomingEvents,
    isKumu,
    getKeikiByGuardian,
    getFinancialSummary,
    getMemberDuesByMember,
    getTitleSettings,
    signOut,
    getPendingPaymentSubmissions,
    getPendingApprovalExpenses,
    getClassLevelsForHalau,
    getRSVPsByEvent,
    getMemberRSVP,
  } = storeActions;

  const halau = currentHalauId ? getHalau(currentHalauId) : null;
  // Include storeMembers in deps to ensure re-render when members are updated
  const members = useMemo(() => currentHalauId ? getMembersByHalau(currentHalauId) : [], [currentHalauId, getMembersByHalau, storeMembers]);
  // Count only active dancers (exclude guardians, include keiki/minors)
  const activeDancersCount = useMemo(() => members.filter((m) => m.role !== 'guardian').length, [members]);
  // Include storeMembers in deps to ensure pending members list updates in real-time
  const pendingMembers = useMemo(() => currentHalauId ? getPendingMembers(currentHalauId) : [], [currentHalauId, getPendingMembers, storeMembers]);

  // Get keiki (minors) that need class assignment (classLevel is empty/null)
  const keikiNeedingAssignment = useMemo(() =>
    members.filter((m) => m.isKeiki && (!m.classLevel || m.classLevel === '')),
    [members]
  );

  // Total items needing attention on Dancers button (pending members + keiki needing assignment)
  const dancersPendingItems = useMemo(() =>
    pendingMembers.length + keikiNeedingAssignment.length,
    [pendingMembers.length, keikiNeedingAssignment.length]
  );

  // Derive upcoming events from subscribed state for real-time updates
  // Filter to events in the next 3 months for dashboard count
  const upcomingEvents = useMemo(() => {
    if (!currentHalauId) return [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const threeMonthsLater = addMonths(today, 3).toISOString().split('T')[0];
    return storeEvents
      .filter((e) => e.halauId === currentHalauId && !e.isCancelled && e.date >= todayStr && e.date <= threeMonthsLater)
      .sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [currentHalauId, storeEvents]);
  const financialSummary = useMemo(() => currentHalauId ? getFinancialSummary(currentHalauId) : { totalCollected: 0, totalPending: 0, totalOverdue: 0, totalOwedToMembers: 0 }, [currentHalauId, getFinancialSummary, storeMemberDues]);
  const isTeacher = isKumu();
  const myKeiki = useMemo(() => currentMember ? getKeikiByGuardian(currentMember.id) : [], [currentMember, getKeikiByGuardian]);
  const myKeikiIds = useMemo(() => myKeiki.map((k) => k.id), [myKeiki]);
  const titleSettings = useMemo(() => currentHalauId ? getTitleSettings(currentHalauId) : { teacherTitle: 'Teacher', studentTitle: 'Student', adminTitle: 'Admin', guardianTitle: 'Parent/Guardian' }, [currentHalauId, getTitleSettings]);

  // Class levels for label lookup (so renamed levels show correctly everywhere)
  const classLevels = useMemo(() => currentHalauId ? getClassLevelsForHalau(currentHalauId) : [], [currentHalauId, getClassLevelsForHalau, halaus]);
  const getClassLabel = (value?: string) => {
    if (!value) return null;
    return classLevels.find((l) => l.value === value)?.label || value;
  };

  // Calculate total pending items for teachers/admins badge
  const pendingPaymentSubmissions = useMemo(() => currentHalauId ? getPendingPaymentSubmissions(currentHalauId) : [], [currentHalauId, getPendingPaymentSubmissions, storePendingPaymentSubmissions]);
  const pendingExpenseApprovals = useMemo(() => currentHalauId ? getPendingApprovalExpenses(currentHalauId) : [], [currentHalauId, getPendingApprovalExpenses]);
  const totalPendingItems = useMemo(() => {
    return pendingMembers.length + pendingPaymentSubmissions.length + pendingExpenseApprovals.length;
  }, [pendingMembers.length, pendingPaymentSubmissions.length, pendingExpenseApprovals.length]);

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Check if user needs class assignment
  const isGuardian = currentMember?.role === 'guardian';
  const isStudent = currentMember?.role === 'student';
  const hasClassLevel = currentMember?.classLevel && currentMember.classLevel !== '';

  // For guardians: collect all class levels across all their keiki
  // A guardian with children in Beginner and Advanced sees content from both classes
  const myKeikiClassLevels = useMemo(
    () => Array.from(new Set(myKeiki.map((k) => k.classLevel).filter(Boolean) as string[])),
    [myKeiki]
  );
  const keikiWithClassLevel = useMemo(() => myKeiki.filter((k) => k.classLevel && k.classLevel !== ''), [myKeiki]);
  const hasKeikiAssigned = keikiWithClassLevel.length > 0;

  // Determine if user has restricted access
  // Students: need class level assigned (not empty)
  // Guardians: always have access — they see content through their keiki's class assignments
  const isRestrictedAccess = isStudent && !hasClassLevel;

  // Helper function to check if user can see an event - memoized
  // Students/parents must be explicitly assigned to see events
  const canSeeEvent = useCallback((event: typeof upcomingEvents[0]) => {
    // Teachers/admins see all events
    if (isTeacher) return true;
    // Students/parents must be explicitly assigned to see an event
    // If no participants specified, students/parents don't see it
    if (!event.participantIds || event.participantIds.length === 0) return false;
    // Show if current member is a participant
    if (currentMember && event.participantIds.includes(currentMember.id)) return true;
    // Show if any of the current member's keiki is a participant
    // This covers guardians automatically — if a keiki is in a class selected for an event,
    // the keiki's ID is in participantIds, so the guardian sees the event
    if (myKeikiIds.some((keikiId) => event.participantIds?.includes(keikiId))) return true;
    return false;
  }, [isTeacher, currentMember, myKeikiIds]);

  // Apply dashboard filter for teachers/admins
  const applyDashboardFilter = useCallback((event: typeof upcomingEvents[0]) => {
    if (!isTeacher || dashboardEventFilter === 'all') return true;
    if (dashboardEventFilter === 'my_events') {
      return event.createdBy === currentMember?.id;
    }
    return event.type === dashboardEventFilter;
  }, [isTeacher, dashboardEventFilter, currentMember?.id]);

  // Filter performances - only show if user is assigned and matches dashboard filter
  const upcomingPerformances = useMemo(() => upcomingEvents.filter((e) => {
    if (e.type !== 'performance') return false;
    if (!canSeeEvent(e)) return false;
    return applyDashboardFilter(e);
  }), [upcomingEvents, canSeeEvent, applyDashboardFilter]);

  // Filter other events - only show if user is assigned and matches dashboard filter
  const upcomingOtherEvents = useMemo(() => upcomingEvents.filter((e) => {
    if (e.type === 'performance') return false;
    if (!canSeeEvent(e)) return false;
    return applyDashboardFilter(e);
  }), [upcomingEvents, canSeeEvent, applyDashboardFilter]);

  // Count of events the user can see (assigned/invited to)
  const myUpcomingEventsCount = upcomingPerformances.length + upcomingOtherEvents.length;

  // RSVP helpers — storeRsvps is subscribed above so this re-computes on every RSVP change
  const getMyRSVP = useCallback((eventId: string) => {
    if (!currentMember) return null;
    return storeRsvps.find((r) => r.eventId === eventId && r.memberId === currentMember.id) ?? null;
  }, [storeRsvps, currentMember]);

  const getRSVPCounts = useCallback((eventId: string) => {
    const eventRsvps = storeRsvps.filter((r) => r.eventId === eventId);
    return {
      going: eventRsvps.filter((r) => r.status === 'going').length,
      maybe: eventRsvps.filter((r) => r.status === 'maybe').length,
      not_going: eventRsvps.filter((r) => r.status === 'not_going').length,
    };
  }, [storeRsvps]);

  // Get student's payment status from financial module
  // For guardians, include their keiki's dues as well
  const studentMemberDues = useMemo(() => {
    if (!currentMember) return [];
    const myDues = getMemberDuesByMember(currentMember.id);
    // If guardian, also get keiki dues
    if (isGuardian && myKeikiIds.length > 0) {
      const keikiDues = myKeikiIds.flatMap((keikiId) => getMemberDuesByMember(keikiId));
      return [...myDues, ...keikiDues];
    }
    return myDues;
  }, [currentMember, getMemberDuesByMember, isGuardian, myKeikiIds]);

  // Filter dues to find past due payments (due date has passed, not paid)
  const studentOverdueDues = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    // Past Due = due date has passed (any unpaid payment where dueDate < today)
    return studentMemberDues.filter((d) => d.status !== 'paid' && d.dueDate < todayStr);
  }, [studentMemberDues]);

  // Total owed includes: all past due payments + payments due within 5 days
  const totalOwed = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Calculate 5 days from now
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const fiveDaysFromNowStr = fiveDaysFromNow.toISOString().split('T')[0];

    return studentMemberDues
      .filter((d) => {
        if (d.status === 'paid') return false;
        // Include if: past due (due date already passed) OR due within 5 days
        return d.dueDate <= fiveDaysFromNowStr;
      })
      .reduce((sum, d) => sum + (d.amount - d.amountPaid), 0);
  }, [studentMemberDues]);
  const hasOverdue = studentOverdueDues.length > 0;

  const onRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setRefreshing(true);
    // Increment key to force useMemo chains to recompute from current store state
    setRefreshKey((k) => k + 1);
    refreshTimerRef.current = setTimeout(() => setRefreshing(false), 600);
  }, []);

  const StatCard = ({
    title,
    value,
    icon,
    color,
    delay,
    onPress,
    badge,
  }: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    delay: number;
    onPress?: () => void;
    badge?: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} className="flex-1">
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        className={cn(
          'rounded-2xl p-4',
          isDark ? 'bg-gray-900/80' : 'bg-white',
          onPress && 'active:opacity-80'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.6 : 0.25,
          shadowRadius: 8,
          elevation: isDark ? 8 : 6,
        }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="relative">
            <View
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              {icon}
            </View>
            {badge && badge > 0 ? (
              <View
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 rounded-full items-center justify-center px-1"
                style={{ backgroundColor: '#EF4444' }}
              >
                <Text className="text-white text-xs font-bold">
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
          {value}
        </Text>
        <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-500' : 'text-gray-500')}>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );

  const QuickAction = ({
    title,
    icon,
    onPress,
    delay,
  }: {
    title: string;
    icon: React.ReactNode;
    onPress: () => void;
    delay: number;
  }) => (
    <Animated.View entering={FadeInRight.delay(delay).duration(400)}>
      <Pressable
        onPress={onPress}
        className={cn(
          'flex-row items-center px-4 py-3.5 rounded-2xl active:opacity-70',
          isDark ? 'bg-gray-900/80' : 'bg-white'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.6 : 0.25,
          shadowRadius: 8,
          elevation: isDark ? 8 : 6,
        }}
      >
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: `${theme.primary}15` }}
        >
          {icon}
        </View>
        <Text className={cn('flex-1 font-medium', isDark ? 'text-white' : 'text-gray-900')}>
          {title}
        </Text>
        <ChevronRight size={20} color={isDark ? '#6B6B6B' : '#9CA3AF'} />
      </Pressable>
    </Animated.View>
  );

  if (!halau) {
    // Root layout will redirect to onboarding
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
        <Text className={cn('text-lg', isDark ? 'text-white' : 'text-gray-900')}>
          Loading...
        </Text>
      </View>
    );
  }

  // Restricted access view for students/guardians waiting for class assignment
  if (isRestrictedAccess) {
    return (
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-[#FAFAFA]')}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
              progressViewOffset={0}
              progressBackgroundColor={isDark ? '#1A1A1A' : '#FFFFFF'}
            />
          }
        >
          {/* Header */}
          <LinearGradient
            colors={[theme.gradientStart, theme.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              paddingTop: insets.top + 16,
              paddingBottom: 80,
              paddingHorizontal: 20,
              borderBottomLeftRadius: 32,
              borderBottomRightRadius: 32,
            }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-white/70 text-sm font-medium">Welcome</Text>
                <Text className="text-white text-2xl font-bold">
                  {currentMember?.firstName || currentUser?.firstName || 'Guest'}
                </Text>
              </View>
              <Pressable
                onPress={onRefresh}
                className="w-10 h-10 bg-white/15 rounded-xl items-center justify-center active:bg-white/25"
              >
                <RefreshCw size={18} color="white" />
              </Pressable>
            </View>

            <View className="flex-row items-center">
              {halau.logo ? (
                <Image
                  source={{ uri: halau.logo }}
                  className="w-12 h-12 rounded-xl mr-3"
                  style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
                />
              ) : (
                <View className="w-12 h-12 bg-white/15 rounded-xl items-center justify-center mr-3">
                  <Text className="text-2xl">🌺</Text>
                </View>
              )}
              <View>
                <Text className="text-white font-semibold text-lg">{halau.name}</Text>
                <Text className="text-white/70 text-sm">
                  {isGuardian ? titleSettings.guardianTitle : titleSettings.studentTitle}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Restricted Access Content */}
          <View className="px-5 -mt-12">
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View
                className={cn(
                  'rounded-2xl p-6 items-center',
                  isDark ? 'bg-gray-900/80' : 'bg-white'
                )}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <View
                  className="w-20 h-20 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: `${theme.accent}15` }}
                >
                  <Lock size={40} color={theme.accent} />
                </View>

                <Text className={cn('text-xl font-bold text-center mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                  {isGuardian ? 'Waiting for Class Assignment' : 'Awaiting Class Assignment'}
                </Text>

                <Text className={cn('text-center mb-6', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {isGuardian
                    ? myKeiki.length === 0
                      ? 'Please add your child(ren) below. Once added, your teacher will assign them to the appropriate class level.'
                      : 'Your child(ren) are waiting to be assigned to a class level by the teacher. Once assigned, you will have full access to the app.'
                    : 'Your teacher will assign you to a class level soon. Once assigned, you will have full access to events, calendar, and more.'}
                </Text>

                {/* Show keiki list for guardians */}
                {isGuardian && myKeiki.length > 0 && (
                  <View className="w-full mb-4">
                    <Text className={cn('text-sm font-semibold mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Your Children
                    </Text>
                    {myKeiki.map((keiki) => (
                      <View
                        key={keiki.id}
                        className={cn(
                          'flex-row items-center p-3 rounded-xl mb-2',
                          isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                      >
                        <View
                          className={cn(
                            'w-10 h-10 rounded-full items-center justify-center mr-3',
                            isDark ? 'bg-gray-700' : 'bg-gray-200'
                          )}
                        >
                          <Text className={cn('font-bold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                            {keiki.firstName?.charAt(0)}{keiki.lastName?.charAt(0)}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            {keiki.firstName} {keiki.lastName}
                          </Text>
                          <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {keiki.classLevel && keiki.classLevel !== 'minor'
                              ? `Class: ${getClassLabel(keiki.classLevel)}`
                              : 'Awaiting class assignment'}
                          </Text>
                        </View>
                        {keiki.classLevel && keiki.classLevel !== 'minor' ? (
                          <CheckCircle size={20} color="#10B981" />
                        ) : (
                          <Clock size={20} color={theme.accent} />
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {/* Add Keiki Button for Guardians */}
                {isGuardian && (
                  <Pressable
                    onPress={() => router.push('/members?addKeiki=true' as never)}
                    className="w-full py-3.5 rounded-xl items-center flex-row justify-center active:opacity-80"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Baby size={20} color="white" />
                    <Text className="text-white font-semibold ml-2">
                      {myKeiki.length === 0 ? 'Add Your Child' : 'Add Another Child'}
                    </Text>
                  </Pressable>
                )}

                {/* Info box */}
                <View
                  className={cn(
                    'w-full p-4 rounded-xl mt-4',
                    isDark ? 'bg-gray-800' : 'bg-gray-50'
                  )}
                >
                  <View className="flex-row items-start">
                    <AlertCircle size={18} color={theme.primary} className="mr-2 mt-0.5" />
                    <View className="flex-1 ml-2">
                      <Text className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                        {isGuardian
                          ? 'Contact your teacher if you have questions about the enrollment process or class schedules.'
                          : 'Contact your teacher if you have questions about class assignments.'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* School Info */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mt-4">
              <View
                className={cn(
                  'rounded-2xl p-4',
                  isDark ? 'bg-gray-900/80' : 'bg-white'
                )}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <Text className={cn('font-semibold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                  School Information
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {halau.description || `You are enrolled at ${halau.name}. Full access to events, calendar, and resources will be available once your class assignment is confirmed.`}
                </Text>
              </View>
            </Animated.View>

            {/* Sign Out Option */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mt-6 mb-8">
              <Pressable
                onPress={() => {
                  signOut();
                  setTimeout(() => {
                    router.replace('/auth');
                  }, 50);
                }}
                className="flex-row items-center justify-center py-3 active:opacity-70"
              >
                <LogOut size={18} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
                <Text className={cn('ml-2 font-medium', isDark ? 'text-white/50' : 'text-gray-400')}>
                  Sign Out
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-[#FAFAFA]')}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
            progressViewOffset={0}
            progressBackgroundColor={isDark ? '#1A1A1A' : '#FFFFFF'}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 16,
            paddingBottom: 80,
            paddingHorizontal: 20,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1">
              <Text className="text-white/70 text-sm font-medium">Welcome back</Text>
              <Text className="text-white text-2xl font-bold">
                {currentMember?.firstName || currentUser?.firstName || 'Guest'}
              </Text>
            </View>
            <Pressable
              onPress={onRefresh}
              className="w-10 h-10 bg-white/15 rounded-xl items-center justify-center active:bg-white/25"
            >
              <RefreshCw size={18} color="white" />
            </Pressable>
          </View>

          <View className="flex-row items-center">
            {halau.logo ? (
              <Image
                source={{ uri: halau.logo }}
                className="w-12 h-12 rounded-xl mr-3"
                style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }}
              />
            ) : (
              <View className="w-12 h-12 bg-white/15 rounded-xl items-center justify-center mr-3">
                <Text className="text-2xl">🌺</Text>
              </View>
            )}
            <View>
              <Text className="text-white font-semibold text-lg">{halau.name}</Text>
              <Text className="text-white/70 text-sm">
                {isTeacher ? titleSettings.teacherTitle : titleSettings.studentTitle} • {activeDancersCount} dancers
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Cards */}
        <ErrorBoundary fallback={<View className="mx-5 mt-4 h-24 rounded-2xl bg-gray-200 dark:bg-gray-800 mb-4 items-center justify-center"><Text className="text-gray-500 text-sm">Stats unavailable</Text></View>}>
          <View className="px-5 -mt-12">
            <View className="flex-row gap-3 mb-4">
              <StatCard
                title="Dancers"
                value={activeDancersCount}
                icon={<Users size={20} color={theme.primary} />}
                color={theme.primary}
                delay={100}
                onPress={() => router.push('/members' as never)}
                badge={isTeacher && dancersPendingItems > 0 ? dancersPendingItems : undefined}
              />
              <StatCard
                title="Events"
                value={myUpcomingEventsCount}
                icon={<Calendar size={20} color={theme.secondary} />}
                color={theme.secondary}
                delay={150}
                onPress={() => router.push('/events' as never)}
              />
            </View>

            {isTeacher && (
              <View className="flex-row gap-3 mb-6">
                <StatCard
                  title="Pending"
                  value={`$${(financialSummary.totalPending + financialSummary.totalOverdue).toLocaleString()}`}
                  icon={<Clock size={20} color={theme.accent} />}
                  color={theme.accent}
                  delay={200}
                  onPress={() => router.push('/financials?tab=dues&filter=pending' as never)}
                  badge={pendingPaymentSubmissions.length > 0 ? pendingPaymentSubmissions.length : undefined}
                />
                <StatCard
                  title="Collected"
                  value={`$${financialSummary.totalCollected.toLocaleString()}`}
                  icon={<TrendingUp size={20} color="#10B981" />}
                  color="#10B981"
                  delay={250}
                  onPress={() => router.push('/financials?tab=history' as never)}
                />
              </View>
            )}
          </View>
        </ErrorBoundary>

        <View className="px-5">
          {/* Student Payment Status Card */}
          {!isTeacher && !isGuardian && (
            <ErrorBoundary fallback={null}>
              <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
                <Pressable
                  onPress={() => router.push('/financials' as never)}
                  className={cn(
                    'rounded-2xl p-4 flex-row items-center',
                    isDark ? 'bg-gray-900/80' : 'bg-white'
                  )}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.5 : 0.2,
                    shadowRadius: 6,
                    elevation: isDark ? 6 : 5,
                    borderLeftWidth: 4,
                    borderLeftColor: hasOverdue ? '#EF4444' : totalOwed > 0 ? theme.accent : '#10B981',
                  }}
                >
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                    style={{
                      backgroundColor: hasOverdue
                        ? '#EF444415'
                        : totalOwed > 0
                          ? `${theme.accent}15`
                          : '#10B98115'
                    }}
                  >
                    {hasOverdue ? (
                      <AlertCircle size={24} color="#EF4444" />
                    ) : totalOwed > 0 ? (
                      <Clock size={24} color={theme.accent} />
                    ) : (
                      <CheckCircle size={24} color="#10B981" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-bold text-base"
                      style={{
                        color: hasOverdue
                          ? '#EF4444'
                          : totalOwed > 0
                            ? theme.accent
                            : '#10B981'
                      }}
                    >
                      {hasOverdue
                        ? 'Past Due Balance'
                        : totalOwed > 0
                          ? 'Balance Due'
                          : 'All Paid Up!'}
                    </Text>
                    <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {totalOwed > 0
                        ? `$${totalOwed.toLocaleString()} outstanding`
                        : 'No payments due at this time'}
                    </Text>
                  </View>
                  <ChevronRight
                    size={20}
                    color={isDark ? '#6B7280' : '#9CA3AF'}
                  />
                </Pressable>
              </Animated.View>
            </ErrorBoundary>
          )}

          {/* Guardian info card — guardians cannot access school financial data */}
          {isGuardian && (
            <ErrorBoundary fallback={null}>
              <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
                <View
                  className={cn(
                    'rounded-2xl p-4 flex-row items-center',
                    isDark ? 'bg-gray-900/80' : 'bg-white'
                  )}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.5 : 0.2,
                    shadowRadius: 6,
                    elevation: isDark ? 6 : 5,
                    borderLeftWidth: 4,
                    borderLeftColor: isDark ? '#374151' : '#E5E7EB',
                  }}
                >
                  <View
                    className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                    style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}
                  >
                    <Lock size={24} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  </View>
                  <View className="flex-1">
                    <Text className={cn('font-semibold text-base', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Financial data is restricted
                    </Text>
                    <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      Not authorized to view school financial records. Contact your teacher for billing questions.
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </ErrorBoundary>
          )}

          {/* Pending Approvals Alert */}
          {isTeacher && pendingMembers.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Pressable
                onPress={() => router.push('/members/pending' as never)}
                className={cn(
                  'rounded-2xl p-4 mb-6 flex-row items-center',
                  isDark ? 'bg-gray-900/80' : 'bg-white'
                )}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                  borderLeftWidth: 4,
                  borderLeftColor: theme.accent,
                }}
              >
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: `${theme.accent}15` }}
                >
                  <UserPlus size={20} color={theme.accent} />
                </View>
                <View className="flex-1">
                  <Text style={{ color: theme.accent }} className="font-semibold">
                    {pendingMembers.length} Pending Approval{pendingMembers.length > 1 ? 's' : ''}
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Tap to review new member requests
                  </Text>
                </View>
                <ChevronRight size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </Pressable>
            </Animated.View>
          )}

          {/* Quick Actions */}
          {isTeacher && (
            <Animated.View entering={FadeInDown.delay(350).duration(400)}>
              <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                Quick Actions
              </Text>
              <View className="gap-2 mb-6">
                <QuickAction
                  title="Create Event"
                  icon={<CalendarPlus size={20} color={theme.primary} />}
                  onPress={() => router.push('/(tabs)/events?action=add' as never)}
                  delay={400}
                />
                <QuickAction
                  title="Mark Attendance"
                  icon={<ClipboardCheck size={20} color={theme.primary} />}
                  onPress={() => router.push('/attendance' as never)}
                  delay={450}
                />
              </View>
            </Animated.View>
          )}

          {/* Event Filter for Teachers/Admins */}
          {isTeacher && (
            <Animated.View entering={FadeInDown.delay(475).duration(400)} className="mb-4">
              <View className="flex-row items-center justify-between">
                <Text className={cn('text-base font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  Events
                </Text>
                <Pressable
                  onPress={() => setShowDashboardFilterModal(true)}
                  className={cn(
                    'flex-row items-center px-3 py-1.5 rounded-full',
                    dashboardEventFilter !== 'all'
                      ? ''
                      : isDark ? 'bg-gray-800' : 'bg-gray-100'
                  )}
                  style={dashboardEventFilter !== 'all' ? { backgroundColor: `${theme.primary}15` } : undefined}
                >
                  <Filter size={14} color={dashboardEventFilter !== 'all' ? theme.primary : (isDark ? '#9CA3AF' : '#6B7280')} />
                  <Text
                    className={cn(
                      'ml-1.5 text-sm font-medium',
                      dashboardEventFilter !== 'all'
                        ? ''
                        : isDark ? 'text-gray-400' : 'text-gray-500'
                    )}
                    style={dashboardEventFilter !== 'all' ? { color: theme.primary } : undefined}
                  >
                    {dashboardEventFilter === 'all'
                      ? 'All'
                      : dashboardEventFilter === 'my_events'
                        ? 'My Events'
                        : dashboardEventFilter.charAt(0).toUpperCase() + dashboardEventFilter.slice(1)}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Upcoming Performances Section - moved to top */}
          {upcomingPerformances.length > 0 && (
            <Animated.View entering={FadeInDown.delay(isTeacher ? 500 : 300).duration(400)} className="mb-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className={cn('text-base font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  Upcoming Performances
                </Text>
                <Pressable onPress={() => router.push('/events' as never)}>
                  <Text style={{ color: theme.secondary }} className="text-sm font-medium">See All</Text>
                </Pressable>
              </View>

              <View className="gap-2">
                {upcomingPerformances.slice(0, 3).map((event) => (
                  <Pressable
                    key={event.id}
                    onPress={() => router.push(`/events/${event.id}` as never)}
                    className={cn(
                      'rounded-xl px-3 py-2.5 active:opacity-80',
                      isDark ? 'bg-gray-900/80' : 'bg-white'
                    )}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: isDark ? 0.5 : 0.2,
                      shadowRadius: 6,
                      elevation: isDark ? 6 : 5,
                    }}
                  >
                    <View className="flex-row items-center">
                      {/* Date Badge - Compact */}
                      <View
                        className="w-11 rounded-lg items-center justify-center py-1.5 mr-3"
                        style={{ backgroundColor: `${theme.secondary}15` }}
                      >
                        <Text style={{ color: theme.secondary }} className="text-lg font-bold leading-tight">
                          {format(parseISO(event.date), 'd')}
                        </Text>
                        <Text style={{ color: theme.secondary }} className="text-[10px] font-semibold">
                          {format(parseISO(event.date), 'MMM').toUpperCase()}
                        </Text>
                      </View>

                      <View className="flex-1 mr-2">
                        {/* Title Row with Badge */}
                        <View className="flex-row items-center mb-0.5">
                          <Text
                            className={cn('font-semibold text-sm flex-1 mr-2', isDark ? 'text-white' : 'text-gray-900')}
                            numberOfLines={1}
                          >
                            {event.title}
                          </Text>
                          {(isToday(parseISO(event.date)) || isTomorrow(parseISO(event.date))) && (
                            <View
                              className="px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: isToday(parseISO(event.date))
                                  ? `${theme.primary}15`
                                  : `${theme.accent}15`
                              }}
                            >
                              <Text
                                style={{
                                  color: isToday(parseISO(event.date))
                                    ? theme.primary
                                    : theme.accent
                                }}
                                className="text-[10px] font-semibold"
                              >
                                {isToday(parseISO(event.date)) ? 'Today' : 'Tomorrow'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Time & Location Row */}
                        <View className="flex-row items-center">
                          <Clock size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            {event.startTime}
                          </Text>
                          {event.location && (
                            <>
                              <Text className={cn('mx-1.5', isDark ? 'text-gray-600' : 'text-gray-300')}>•</Text>
                              <MapPin size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                              <Text
                                className={cn('text-xs ml-1 flex-1', isDark ? 'text-gray-400' : 'text-gray-500')}
                                numberOfLines={1}
                              >
                                {event.location}
                              </Text>
                            </>
                          )}
                        </View>

                        {/* RSVP Row */}
                        {(() => {
                          const myRsvp = getMyRSVP(event.id);
                          const counts = isTeacher ? getRSVPCounts(event.id) : null;
                          if (!myRsvp && !counts) return null;
                          return (
                            <View className="flex-row items-center mt-1 gap-1.5 flex-wrap">
                              {isTeacher && counts ? (
                                <>
                                  <View className="px-1.5 py-0.5 rounded-full bg-emerald-500/10">
                                    <Text className="text-[10px] font-semibold text-emerald-600">{counts.going} going</Text>
                                  </View>
                                  {counts.maybe > 0 && (
                                    <View className="px-1.5 py-0.5 rounded-full bg-amber-500/10">
                                      <Text className="text-[10px] font-semibold text-amber-600">{counts.maybe} maybe</Text>
                                    </View>
                                  )}
                                  {counts.not_going > 0 && (
                                    <View className="px-1.5 py-0.5 rounded-full bg-red-500/10">
                                      <Text className="text-[10px] font-semibold text-red-500">{counts.not_going} can't go</Text>
                                    </View>
                                  )}
                                </>
                              ) : myRsvp ? (
                                <View className={cn(
                                  'px-1.5 py-0.5 rounded-full',
                                  myRsvp.status === 'going' ? 'bg-emerald-500/10' :
                                  myRsvp.status === 'maybe' ? 'bg-amber-500/10' : 'bg-red-500/10'
                                )}>
                                  <Text className={cn(
                                    'text-[10px] font-semibold',
                                    myRsvp.status === 'going' ? 'text-emerald-600' :
                                    myRsvp.status === 'maybe' ? 'text-amber-600' : 'text-red-500'
                                  )}>
                                    {myRsvp.status === 'going' ? "You're going" : myRsvp.status === 'maybe' ? 'Maybe' : "Can't go"}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })()}
                      </View>

                      <ChevronRight size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
                    </View>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Upcoming Events - List View (Practice, Meetings, Workshops, Other) */}
          <Animated.View entering={FadeInDown.delay(isTeacher ? 600 : 350).duration(400)}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className={cn('text-base font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Upcoming Events
              </Text>
              <Pressable onPress={() => router.push('/events' as never)}>
                <Text style={{ color: theme.primary }} className="text-sm font-medium">See All</Text>
              </Pressable>
            </View>

            {upcomingOtherEvents.length > 0 ? (
              <View className="gap-2">
                {upcomingOtherEvents.slice(0, 5).map((event, index) => (
                  <Pressable
                    key={event.id}
                    onPress={() => router.push(`/events/${event.id}` as never)}
                    className={cn(
                      'rounded-xl px-3 py-2.5 active:opacity-80',
                      isDark ? 'bg-gray-900/80' : 'bg-white'
                    )}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: isDark ? 0.5 : 0.2,
                      shadowRadius: 6,
                      elevation: isDark ? 6 : 5,
                    }}
                  >
                    <View className="flex-row items-center">
                      {/* Date Badge - Compact */}
                      <View
                        className="w-11 rounded-lg items-center justify-center py-1.5 mr-3"
                        style={{ backgroundColor: `${theme.primary}15` }}
                      >
                        <Text
                          className="text-lg font-bold leading-tight"
                          style={{ color: theme.primary }}
                        >
                          {format(parseISO(event.date), 'd')}
                        </Text>
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: theme.primary }}
                        >
                          {format(parseISO(event.date), 'MMM').toUpperCase()}
                        </Text>
                      </View>

                      <View className="flex-1 mr-2">
                        {/* Title Row with Type & Today Badge */}
                        <View className="flex-row items-center mb-0.5">
                          <Text
                            className={cn('font-semibold text-sm flex-1 mr-2', isDark ? 'text-white' : 'text-gray-900')}
                            numberOfLines={1}
                          >
                            {event.title}
                          </Text>
                          <View className="flex-row items-center gap-1">
                            <View
                              className="px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${theme.primary}15` }}
                            >
                              <Text style={{ color: theme.primary }} className="text-[10px] font-medium capitalize">
                                {event.type}
                              </Text>
                            </View>
                            {(isToday(parseISO(event.date)) || isTomorrow(parseISO(event.date))) && (
                              <View
                                className="px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor: isToday(parseISO(event.date))
                                    ? `${theme.primary}15`
                                    : `${theme.accent}15`
                                }}
                              >
                                <Text
                                  style={{
                                    color: isToday(parseISO(event.date))
                                      ? theme.primary
                                      : theme.accent
                                  }}
                                  className="text-[10px] font-semibold"
                                >
                                  {isToday(parseISO(event.date)) ? 'Today' : 'Tomorrow'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Time & Location Row */}
                        <View className="flex-row items-center">
                          <Clock size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            {event.startTime}
                          </Text>
                          {event.location && (
                            <>
                              <Text className={cn('mx-1.5', isDark ? 'text-gray-600' : 'text-gray-300')}>•</Text>
                              <MapPin size={12} color={isDark ? '#9CA3AF' : '#6B7280'} />
                              <Text
                                className={cn('text-xs ml-1 flex-1', isDark ? 'text-gray-400' : 'text-gray-500')}
                                numberOfLines={1}
                              >
                                {event.location}
                              </Text>
                            </>
                          )}
                        </View>

                        {/* RSVP Row */}
                        {(() => {
                          const myRsvp = getMyRSVP(event.id);
                          const counts = isTeacher ? getRSVPCounts(event.id) : null;
                          if (!myRsvp && !counts) return null;
                          return (
                            <View className="flex-row items-center mt-1 gap-1.5 flex-wrap">
                              {isTeacher && counts ? (
                                <>
                                  <View className="px-1.5 py-0.5 rounded-full bg-emerald-500/10">
                                    <Text className="text-[10px] font-semibold text-emerald-600">{counts.going} going</Text>
                                  </View>
                                  {counts.maybe > 0 && (
                                    <View className="px-1.5 py-0.5 rounded-full bg-amber-500/10">
                                      <Text className="text-[10px] font-semibold text-amber-600">{counts.maybe} maybe</Text>
                                    </View>
                                  )}
                                  {counts.not_going > 0 && (
                                    <View className="px-1.5 py-0.5 rounded-full bg-red-500/10">
                                      <Text className="text-[10px] font-semibold text-red-500">{counts.not_going} can't go</Text>
                                    </View>
                                  )}
                                </>
                              ) : myRsvp ? (
                                <View className={cn(
                                  'px-1.5 py-0.5 rounded-full',
                                  myRsvp.status === 'going' ? 'bg-emerald-500/10' :
                                  myRsvp.status === 'maybe' ? 'bg-amber-500/10' : 'bg-red-500/10'
                                )}>
                                  <Text className={cn(
                                    'text-[10px] font-semibold',
                                    myRsvp.status === 'going' ? 'text-emerald-600' :
                                    myRsvp.status === 'maybe' ? 'text-amber-600' : 'text-red-500'
                                  )}>
                                    {myRsvp.status === 'going' ? "You're going" : myRsvp.status === 'maybe' ? 'Maybe' : "Can't go"}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })()}
                      </View>

                      <ChevronRight size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View
                className={cn('rounded-xl p-4 items-center', isDark ? 'bg-gray-900/80' : 'bg-gray-100')}
              >
                <Text className={cn('text-center text-sm', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  No upcoming events scheduled
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Dashboard Event Filter Modal */}
      <Modal visible={showDashboardFilterModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowDashboardFilterModal(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Filter Events
            </Text>
            <View className="w-6" />
          </View>

          <ScrollView className="flex-1 px-5 py-4">
            <View className="gap-2">
              {/* All Events */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('all');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'all'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  All Events
                </Text>
                {dashboardEventFilter === 'all' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* My Events */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('my_events');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'my_events'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  My Events
                </Text>
                {dashboardEventFilter === 'my_events' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Divider */}
              <View className={cn('h-px my-2', isDark ? 'bg-gray-800' : 'bg-gray-200')} />

              <Text className={cn('text-sm font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                By Type
              </Text>

              {/* Practice */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('practice');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'practice'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Practice
                </Text>
                {dashboardEventFilter === 'practice' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Performance */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('performance');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'performance'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Performance
                </Text>
                {dashboardEventFilter === 'performance' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Meeting */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('meeting');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'meeting'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Meeting
                </Text>
                {dashboardEventFilter === 'meeting' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Workshop */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('workshop');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'workshop'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Workshop
                </Text>
                {dashboardEventFilter === 'workshop' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Other */}
              <Pressable
                onPress={() => {
                  setDashboardEventFilter('other');
                  setShowDashboardFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  dashboardEventFilter === 'other'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Other
                </Text>
                {dashboardEventFilter === 'other' && <Check size={20} color={theme.primary} />}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Trial lifecycle modals — only shown to teacher/instructor roles */}
      <TrialStartModal
        visible={showTrialStart}
        onAcknowledge={acknowledgeTrialStart}
      />
      <TrialReminderModal
        visible={showTrialReminder && !showTrialStart}
        onClose={markTrialReminderSeen}
        daysRemaining={getTrialDaysRemaining()}
      />
      <TrialExpiredModal visible={showTrialExpired} />

      {/* Welcome support popup — shown once per account after first login */}
      <DonationModal
        visible={!hasSeenWelcomePopup}
        onDismiss={markWelcomePopupSeen}
        onContribute={() => {
          markWelcomePopupSeen();
          router.push('/paywall');
        }}
        userRole={currentUserRole}
      />
    </View>
  );
}

export default function DashboardScreen() {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
}
