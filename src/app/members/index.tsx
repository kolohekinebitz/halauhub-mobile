import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform, Alert } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { useSubscription } from '@/lib/useSubscription';
import { cn } from '@/lib/cn';
import { PromoteAdminModal } from '@/components/PromoteAdminModal';
import { addSeatToOwnerBilling, sendAdminInvite } from '@/lib/firebase-firestore';
import { auth } from '@/lib/firebase';
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Check,
  UserPlus,
  Clock,
  GraduationCap,
  Baby,
  Trash2,
  AlertTriangle,
  UserMinus,
  DollarSign,
  Edit3,
  Settings,
  Building2,
  Users,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import type { Member, MembershipPlan, UserRole, ClassLevel, CustomClassLevel } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { s, ms } from '@/lib/scaling';

export default function MembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { addKeiki } = useLocalSearchParams<{ addKeiki?: string }>();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'instructor' | 'student'>('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddKeikiModal, setShowAddKeikiModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [selectedMemberForClass, setSelectedMemberForClass] = useState<Member | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassLevel>('beginner');
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  // Open add keiki modal if URL param is set
  useEffect(() => {
    if (addKeiki === 'true') {
      setShowAddKeikiModal(true);
    }
  }, [addKeiki]);

  // Add class level state - inline mode instead of popup
  const [isAddingClassLevel, setIsAddingClassLevel] = useState(false);
  const [newClassLabel, setNewClassLabel] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');

  // Rename class level state (inline, no separate modal)
  const [classToRename, setClassToRename] = useState<CustomClassLevel | null>(null);
  const [renameClassLabel, setRenameClassLabel] = useState('');
  const [renameClassDescription, setRenameClassDescription] = useState('');

  // Remove member state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);

  // Promote to admin state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [memberToPromote, setMemberToPromote] = useState<Member | null>(null);

  // Student limit upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [membershipPlan, setMembershipPlan] = useState<MembershipPlan>('monthly');
  const [newMemberClass, setNewMemberClass] = useState<ClassLevel>('beginner');

  // Keiki form state
  const [keikiFirstName, setKeikiFirstName] = useState('');
  const [keikiLastName, setKeikiLastName] = useState('');

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const members = useAppStore((s) => s.members); // Subscribe to members array for reactivity
  const memberDues = useAppStore((s) => s.memberDues); // Subscribe to member dues for paying status
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);
  const addMember = useAppStore((s) => s.addMember);
  const updateMember = useAppStore((s) => s.updateMember);
  const addKeikiMember = useAppStore((s) => s.addKeikiMember);
  const getKeikiByGuardian = useAppStore((s) => s.getKeikiByGuardian);
  const canRemoveKeiki = useAppStore((s) => s.canRemoveKeiki);
  const removeMember = useAppStore((s) => s.removeMember);
  const isKumu = useAppStore((s) => s.isKumu);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  const addCustomClassLevel = useAppStore((s) => s.addCustomClassLevel);
  const updateCustomClassLevel = useAppStore((s) => s.updateCustomClassLevel);
  const deleteCustomClassLevel = useAppStore((s) => s.deleteCustomClassLevel);
  const getTitleSettings = useAppStore((s) => s.getTitleSettings);
  const getHalau = useAppStore((s) => s.getHalau);
  const refreshSchoolData = useAppStore((s) => s.refreshSchoolData);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Subscription info for student limits
  const { tier, maxStudents, hasUnlimitedStudents } = useSubscription();

  // Get theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Filter members for current halau (computed from members array for reactivity)
  const halauMembers = currentHalauId
    ? members.filter((m) => m.halauId === currentHalauId && m.status === 'approved')
    : [];
  const pendingMembers = currentHalauId
    ? members.filter((m) => m.halauId === currentHalauId && m.status === 'pending')
    : [];

  // Debug: log dashboard query results and flag integrity issues
  useEffect(() => {
    if (__DEV__ && currentHalauId) {
      const schoolMembers = members.filter((m) => m.halauId === currentHalauId);
      console.log(`[MembersScreen] halauId=${currentHalauId} total=${schoolMembers.length} approved=${halauMembers.length} pending=${pendingMembers.length}`);

      // Track userIds to detect duplicates within this school
      const seenUserIds = new Map<string, string>();
      for (const m of schoolMembers) {
        console.log(`  member: id=${m.id} userId=${m.userId} name="${m.firstName} ${m.lastName}" role=${m.role} status=${m.status} isManual=${m.isManual ?? false} isKeiki=${m.isKeiki ?? false}`);

        // Warn on duplicate userId
        const prev = seenUserIds.get(m.userId);
        if (prev) {
          console.warn(`  [integrity] DUPLICATE userId="${m.userId}" — "${prev}" and "${m.id}" both in store for school "${currentHalauId}"`);
        }
        seenUserIds.set(m.userId, m.id);

        // Warn on missing required fields (should never happen with new validators)
        if (!m.userId)     console.warn(`  [integrity] EMPTY userId on member "${m.id}" — this should never happen`);
        if (!m.firstName)  console.warn(`  [integrity] MISSING firstName on member "${m.id}"`);
        if (!m.lastName)   console.warn(`  [integrity] MISSING lastName on member "${m.id}"`);
        if (!m.role)       console.warn(`  [integrity] MISSING role on member "${m.id}"`);
        if (!m.status)     console.warn(`  [integrity] MISSING status on member "${m.id}"`);

        // Warn on halauId mismatch (sanity check — should never appear in this loop)
        if (m.halauId !== currentHalauId) {
          console.warn(`  [integrity] halauId MISMATCH on member "${m.id}": stored="${m.halauId}" expected="${currentHalauId}"`);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, currentHalauId]);
  const myKeiki = currentMember ? getKeikiByGuardian(currentMember.id) : [];
  const isTeacher = isKumu();
  const classLevels = currentHalauId ? getClassLevelsForHalau(currentHalauId) : [];
  const titleSettings = currentHalauId ? getTitleSettings(currentHalauId) : { teacherTitle: 'Teacher', studentTitle: 'Student', adminTitle: 'Admin', guardianTitle: 'Parent/Guardian' };

  // Calculate current student count (students only, not teachers/admins)
  const studentCount = halauMembers.filter((m) => m.role === 'student').length;
  const isAtStudentLimit = !hasUnlimitedStudents && maxStudents > 0 && studentCount >= maxStudents;
  const studentsRemaining = hasUnlimitedStudents ? -1 : Math.max(0, maxStudents - studentCount);

  // Get role display name
  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'teacher':
        return titleSettings.teacherTitle;
      case 'student':
        return titleSettings.studentTitle;
      case 'admin':
        return titleSettings.adminTitle;
      case 'guardian':
        return titleSettings.guardianTitle;
      default:
        return role;
    }
  };

  // Get all keiki members
  const allKeiki = halauMembers.filter((m) => m.isKeiki);

  // Helper to get keiki for a specific member
  const getKeikiForMember = (memberId: string) => {
    return allKeiki.filter((k) => k.linkedToMemberId === memberId);
  };

  // Members who need class assignment (approved students without a class level, excluding keiki)
  // Admins may also need class assignment if promoted from student
  const membersNeedingClass = halauMembers.filter(
    (m) => (m.role === 'student' || m.role === 'admin') && !m.classLevel && !m.isKeiki
  );

  // Keiki (minors) that need class assignment (no class level assigned yet)
  // Once a teacher assigns ANY class level (including 'minor'), the keiki is considered assigned
  const keikiNeedingAssignment = allKeiki.filter(
    (k) => !k.classLevel || k.classLevel === ''
  );

  // Total items needing attention for the pending alert
  const totalPendingItems = pendingMembers.length + keikiNeedingAssignment.length;

  // Whether the class filter row should be visible (teacher only, all/student filter selected)
  const showClassFilterRow =
    isTeacher && (selectedFilter === 'all' || selectedFilter === 'student') && classLevels.length > 0;

  // Filter out keiki from main list - they'll show under their guardian
  const filteredMembers = halauMembers
    .filter((m) => {
      // Exclude keiki from the main list
      if (m.isKeiki) return false;
      const matchesSearch =
        m.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = selectedFilter === 'all' || m.role === selectedFilter;
      // Apply class level filter — filters students and admins (admins may have class levels)
      const matchesClassFilter =
        !selectedClassFilter ||
        ((m.role === 'student' || m.role === 'admin') && m.classLevel === selectedClassFilter);
      return matchesSearch && matchesFilter && matchesClassFilter;
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  const toggleMemberExpanded = (memberId: string) => {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleAddMember = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !currentHalauId) return;

    // Check student limit if adding a student
    if (role === 'student' && isAtStudentLimit) {
      setShowAddModal(false);
      setShowUpgradeModal(true);
      return;
    }

    addMember({
      userId: '', // No Firebase UID yet — store.addMember derives "invite:<email>" deterministically
      halauId: currentHalauId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      memberType: 'new',
      membershipPlan,
      status: 'approved',
      classLevel: role === 'student' ? newMemberClass : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setRole('student');
    setMembershipPlan('monthly');
    setNewMemberClass('beginner');
    setShowAddModal(false);
  };

  const handleAddKeiki = () => {
    if (!keikiFirstName.trim() || !keikiLastName.trim() || !currentHalauId) return;

    // Check student limit (keiki are students)
    if (isAtStudentLimit) {
      setShowAddKeikiModal(false);
      setShowUpgradeModal(true);
      return;
    }

    addKeikiMember({
      firstName: keikiFirstName.trim(),
      lastName: keikiLastName.trim(),
      halauId: currentHalauId,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setKeikiFirstName('');
    setKeikiLastName('');
    setShowAddKeikiModal(false);
  };

  const handleRemoveKeiki = (keikiId: string) => {
    if (canRemoveKeiki(keikiId)) {
      removeMember(keikiId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleOpenRemoveModal = (member: Member) => {
    setMemberToRemove(member);
    setShowRemoveModal(true);
  };

  const handleConfirmRemove = () => {
    if (memberToRemove) {
      removeMember(memberToRemove.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRemoveModal(false);
      setMemberToRemove(null);
    }
  };

  const handleOpenPromoteModal = (member: Member) => {
    setMemberToPromote(member);
    setShowPromoteModal(true);
  };

  // Owner absorbs the $6.99/mo cost for the new admin
  const handleAbsorbCost = async (memberId: string) => {
    console.log('[handleAbsorbCost] ABSORB START', memberId);
    const ownerId = auth.currentUser?.uid;
    if (!ownerId) {
      console.error('[handleAbsorbCost] Not authenticated');
      throw new Error('Not authenticated');
    }
    try {
      console.warn('FINANCIAL WRITE', {
        userId: memberId,
        action: 'absorb_seat/client',
        before: { role: memberToPromote?.role, paid: memberToPromote?.paid, billingStatus: memberToPromote?.billingStatus },
      });
      console.log('[handleAbsorbCost] calling addSeatToOwnerBilling', { ownerId, memberId, schoolId: currentHalauId });
      await addSeatToOwnerBilling(ownerId, memberId, currentHalauId ?? '');
      console.log('[handleAbsorbCost] addSeatToOwnerBilling success');
      // Non-financial optimistic update — role and inviteStatus only.
      // Financial fields (paid, billingStatus, paymentResponsibility) are
      // SERVER-AUTHORITATIVE and must NEVER be set by the client.
      updateMember(memberId, { role: 'admin', inviteStatus: 'accepted' } as Partial<Member>);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Await backend truth — refreshSchoolData fetches the version-stamped
      // member record which safeMergeMember will accept (version n+1 > n).
      console.log('[handleAbsorbCost] refreshing school data');
      await refreshSchoolData();
      console.log('[handleAbsorbCost] ABSORB COMPLETE', memberId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[handleAbsorbCost] ABSORB FAILED', memberId, msg);
      throw err;
    }
  };

  // Owner sends an invite — the admin pays their own subscription
  const handleDelegatePayment = async (memberId: string) => {
    const member = memberToPromote;
    const ownerId = auth.currentUser?.uid;
    if (!ownerId || !member) throw new Error('Not authenticated');

    const schoolId = currentHalauId ?? '';
    const ownerNameStr = currentMember ? `${currentMember.firstName} ${currentMember.lastName}` : undefined;
    const schoolNameStr = halau?.name ?? undefined;
    const originalRole = member.role;

    // Build deep links so the email buttons open the invite-accept screen in the app.
    // revertToRole is included in BOTH URLs so declining from either link restores the right role.
    const acceptParams = new URLSearchParams({
      ownerId,
      newAdminId: memberId,
      schoolId,
      revertToRole: originalRole,
      ...(ownerNameStr ? { ownerName: ownerNameStr } : {}),
      ...(schoolNameStr ? { schoolName: schoolNameStr } : {}),
    });
    const declineParams = new URLSearchParams({
      ownerId,
      newAdminId: memberId,
      schoolId,
      revertToRole: originalRole,
    });

    await sendAdminInvite({
      ownerId,
      inviteeId: memberId,
      schoolId,
      inviteeEmail: member.email,
      inviteeName: `${member.firstName} ${member.lastName}`,
      ownerName: ownerNameStr,
      schoolName: schoolNameStr,
      acceptUrl: `vibecode://invite-accept?${acceptParams.toString()}`,
      declineUrl: `vibecode://invite-accept?${declineParams.toString()}&action=decline`,
    });
    // Optimistically mark the member as pending_admin — role and inviteStatus only.
    // paymentResponsibility is SERVER-AUTHORITATIVE and must not be set by the client.
    updateMember(memberId, { role: 'pending_admin', inviteStatus: 'pending' } as Partial<Member>);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Invite Sent', `An email invite has been sent to ${member.email}.`);
  };

  const handleOpenClassAssignment = (member: Member) => {
    setSelectedMemberForClass(member);
    // Validate the stored classLevel still exists; fall back to 'beginner' if deleted
    const existingLevel = classLevels.find((l) => l.value === member.classLevel);
    setSelectedClass(existingLevel ? member.classLevel! : 'beginner');
    setShowClassModal(true);
  };

  const handleAssignClass = () => {
    if (!selectedMemberForClass) return;
    updateMember(selectedMemberForClass.id, { classLevel: selectedClass });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowClassModal(false);
    setSelectedMemberForClass(null);
  };

  const getClassLabel = (classLevel?: ClassLevel) => {
    if (!classLevel) return null;
    const level = classLevels.find((l) => l.value === classLevel);
    return level?.label || classLevel;
  };
  const handleAddClassLevel = () => {
    if (!currentHalauId || !newClassLabel.trim()) return;

    addCustomClassLevel(currentHalauId, newClassLabel.trim(), newClassDescription.trim() || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewClassLabel('');
    setNewClassDescription('');
    setIsAddingClassLevel(false);
  };

  // Handle renaming a class level
  const handleRenameClassLevel = () => {
    if (!currentHalauId || !classToRename || !renameClassLabel.trim()) return;
    updateCustomClassLevel(currentHalauId, classToRename.id, {
      label: renameClassLabel.trim(),
      description: renameClassDescription.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setClassToRename(null);
    setRenameClassLabel('');
    setRenameClassDescription('');
  };

  // Handle opening inline rename form
  const handleOpenRenameModal = (level: CustomClassLevel) => {
    // All levels (including defaults) can now be renamed
    setIsAddingClassLevel(false);
    setClassToRename(level);
    setRenameClassLabel(level.label);
    setRenameClassDescription(level.description || '');
  };

  // Handle deleting a class level
  const handleDeleteClassLevel = (levelId: string) => {
    if (!currentHalauId) return;
    // Don't allow deleting default levels
    if (['minor', 'beginner', 'intermediate', 'advanced'].includes(levelId)) {
      return;
    }
    deleteCustomClassLevel(currentHalauId, levelId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getGuardianName = (memberId?: string) => {
    if (!memberId) return null;
    const guardian = halauMembers.find((m) => m.id === memberId);
    return guardian ? `${guardian.firstName} ${guardian.lastName}` : null;
  };

  // Check if a member has active recurring dues (monthly/annual payments)
  const isMemberPaying = (memberId: string): boolean => {
    const today = new Date().toISOString().split('T')[0];
    // Check for dues that are recurring and either not ended or ending in the future
    const activeDues = memberDues.filter((due) => {
      if (due.memberId !== memberId || due.halauId !== currentHalauId) return false;
      // Check if it's a recurring payment (monthly, weekly, biweekly)
      if (due.isRecurring && due.recurringFrequency) {
        // If no end date, it's ongoing
        if (!due.recurringEndDate) return true;
        // If end date is in the future, it's still active
        return due.recurringEndDate >= today;
      }
      // Non-recurring but unpaid dues also count as "paying" (has payment obligation)
      if (due.status !== 'paid') return true;
      return false;
    });
    return activeDues.length > 0;
  };

  const MemberCard = ({ member, index }: { member: Member; index: number }) => {
    const memberKeiki = getKeikiForMember(member.id);
    const hasKeiki = memberKeiki.length > 0;
    const isExpanded = expandedMembers.has(member.id);

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <View
          className={cn(
            'rounded-xl mb-1.5 overflow-hidden',
            isDark ? 'bg-gray-800/80' : 'bg-white'
          )}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.4 : 0.1,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Pressable
            onPress={() => router.push(`/members/${member.id}` as never)}
            className="flex-row items-center px-3 py-2.5 active:opacity-80"
          >
            <View
              className={cn(
                'w-9 h-9 rounded-full items-center justify-center mr-2.5',
                member.role === 'teacher' ? 'bg-amber-500' : ''
              )}
              style={member.role !== 'teacher' ? { backgroundColor: theme.primary } : undefined}
            >
              <Text className="text-white text-sm font-bold">
                {member.firstName[0]?.toUpperCase() || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center flex-wrap">
                <Text className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                  {member.firstName} {member.lastName}
                </Text>
                <View
                  className={cn(
                    'ml-1.5 px-1.5 py-0.5 rounded-full',
                    member.role === 'teacher' ? 'bg-amber-500/10' : ''
                  )}
                  style={member.role !== 'teacher' ? { backgroundColor: `${theme.primary}15` } : undefined}
                >
                  <Text
                    className={cn(
                      'text-[10px] font-medium',
                      member.role === 'teacher' ? 'text-amber-600' : ''
                    )}
                    style={member.role !== 'teacher' ? { color: theme.primary } : undefined}
                  >
                    {getRoleDisplayName(member.role)}
                  </Text>
                </View>
                {/* Paying Member Badge - only visible to teachers/admins */}
                {member.role === 'student' && isTeacher && (
                  <View
                    className={cn(
                      'ml-1.5 px-1.5 py-0.5 rounded-full flex-row items-center',
                      isMemberPaying(member.id) ? 'bg-green-500/10' : 'bg-gray-500/10'
                    )}
                  >
                    <DollarSign size={8} color={isMemberPaying(member.id) ? '#10B981' : '#6B7280'} />
                    <Text
                      className={cn(
                        'text-[10px] font-medium ml-0.5',
                        isMemberPaying(member.id) ? 'text-green-600' : 'text-gray-500'
                      )}
                    >
                      {isMemberPaying(member.id) ? 'Paying' : 'Non-Paying'}
                    </Text>
                  </View>
                )}
                {hasKeiki && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleMemberExpanded(member.id);
                    }}
                    className="ml-1.5 flex-row items-center px-1.5 py-0.5 rounded-full bg-pink-400/20"
                  >
                    <Baby size={10} color="#F472B6" />
                    <Text className="text-[10px] font-medium text-pink-500 ml-0.5">{memberKeiki.length}</Text>
                    {isExpanded ? (
                      <ChevronUp size={10} color="#F472B6" style={{ marginLeft: 2 }} />
                    ) : (
                      <ChevronDown size={10} color="#F472B6" style={{ marginLeft: 2 }} />
                    )}
                  </Pressable>
                )}
              </View>
              {/* Subtitle: email (teachers only) or role + class (students/guardians) */}
              <View className="flex-row items-center mt-0.5 flex-wrap gap-x-1.5">
                {isTeacher ? (
                  <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={1}>
                    {member.email}
                  </Text>
                ) : (
                  <>
                    <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {getRoleDisplayName(member.role)}
                    </Text>
                    {member.classLevel && (
                      <>
                        <Text className={cn('text-xs', isDark ? 'text-gray-600' : 'text-gray-300')}>·</Text>
                        <View className="flex-row items-center">
                          <GraduationCap size={10} color="#A855F7" />
                          <Text className="text-[11px] font-medium ml-0.5 text-purple-600">
                            {getClassLabel(member.classLevel)}
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                )}
              </View>
              {/* Class level badge — students and admins (admins may have been promoted from students) */}
              {(member.role === 'student' || member.role === 'admin') && member.classLevel && (
                <View className="flex-row items-center mt-1">
                  {isTeacher ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenClassAssignment(member);
                      }}
                      className="flex-row items-center px-1.5 py-0.5 rounded bg-purple-500/10"
                    >
                      <GraduationCap size={10} color="#A855F7" />
                      <Text className="text-[10px] font-medium ml-0.5 text-purple-600">
                        {getClassLabel(member.classLevel)}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="flex-row items-center px-1.5 py-0.5 rounded bg-purple-500/10">
                      <GraduationCap size={10} color="#A855F7" />
                      <Text className="text-[10px] font-medium ml-0.5 text-purple-600">
                        {getClassLabel(member.classLevel)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {/* Assign class prompt — students and admins without a class level */}
              {(member.role === 'student' || member.role === 'admin') && !member.classLevel && isTeacher && (
                <View className="flex-row items-center mt-1">
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenClassAssignment(member);
                    }}
                    className="flex-row items-center px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30"
                  >
                    <GraduationCap size={10} color="#F59E0B" />
                    <Text className="text-[10px] font-medium ml-0.5 text-amber-600">
                      Assign Class
                    </Text>
                  </Pressable>
                </View>
              )}
              {/* Promote to Admin chip — visible to teachers on student OR guardian cards */}
              {(member.role === 'student' || member.role === 'guardian') && isTeacher && member.id !== currentMember?.id && (
                <View className="flex-row items-center mt-1">
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenPromoteModal(member);
                    }}
                    className={cn(
                      'flex-row items-center px-1.5 py-0.5 rounded border',
                      isDark
                        ? 'bg-indigo-500/10 border-indigo-500/30'
                        : 'bg-indigo-50 border-indigo-200'
                    )}
                  >
                    <Settings size={10} color={isDark ? '#818CF8' : '#4F46E5'} />
                    <Text className={cn('text-[10px] font-medium ml-0.5', isDark ? 'text-indigo-400' : 'text-indigo-600')}>
                      Promote to Admin
                    </Text>
                  </Pressable>
                </View>
              )}
              {/* Allow teacher to set their own class level */}
              {member.role === 'teacher' && member.classLevel && (
                <View className="flex-row items-center mt-1">
                  {member.id === currentMember?.id ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenClassAssignment(member);
                      }}
                      className="flex-row items-center px-1.5 py-0.5 rounded bg-purple-500/10"
                    >
                      <GraduationCap size={10} color="#A855F7" />
                      <Text className="text-[10px] font-medium ml-0.5 text-purple-600">
                        {getClassLabel(member.classLevel)}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="flex-row items-center px-1.5 py-0.5 rounded bg-purple-500/10">
                      <GraduationCap size={10} color="#A855F7" />
                      <Text className="text-[10px] font-medium ml-0.5 text-purple-600">
                        {getClassLabel(member.classLevel)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {member.role === 'teacher' && !member.classLevel && member.id === currentMember?.id && (
                <View className="flex-row items-center mt-1">
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleOpenClassAssignment(member);
                    }}
                    className="flex-row items-center px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30"
                  >
                    <GraduationCap size={10} color="#F59E0B" />
                    <Text className="text-[10px] font-medium ml-0.5 text-amber-600">
                      Set Class Level
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
            <ChevronRight size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
          </Pressable>

          {/* Expanded Keiki List */}
          {hasKeiki && isExpanded && (
            <View className={cn('px-3 pb-2 pt-1 border-t', isDark ? 'border-gray-700' : 'border-gray-100')}>
              <Text className={cn('text-[10px] font-medium mb-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                MINORS
              </Text>
              {memberKeiki.map((keiki) => (
                <View
                  key={keiki.id}
                  className={cn(
                    'flex-row items-center px-2 py-1.5 rounded-lg mb-1',
                    isDark ? 'bg-gray-700/50' : 'bg-pink-50'
                  )}
                >
                  <View className="w-6 h-6 rounded-full bg-pink-400 items-center justify-center mr-2">
                    <Baby size={12} color="white" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center flex-wrap">
                      <Text className={cn('font-medium text-xs', isDark ? 'text-white' : 'text-gray-900')}>
                        {keiki.firstName} {keiki.lastName}
                      </Text>
                      {/* Class Level Badge - Teachers can tap to edit */}
                      {keiki.classLevel ? (
                        isTeacher ? (
                          <Pressable
                            onPress={() => handleOpenClassAssignment(keiki)}
                            className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-500/10"
                          >
                            <Text className="text-[10px] font-medium text-purple-600">
                              {getClassLabel(keiki.classLevel)}
                            </Text>
                          </Pressable>
                        ) : (
                          <View className="ml-1.5 px-1.5 py-0.5 rounded bg-purple-500/10">
                            <Text className="text-[10px] font-medium text-purple-600">
                              {getClassLabel(keiki.classLevel)}
                            </Text>
                          </View>
                        )
                      ) : null}
                      {/* Assign Class for Teachers when no class level */}
                      {isTeacher && !keiki.classLevel ? (
                        <Pressable
                          onPress={() => handleOpenClassAssignment(keiki)}
                          className="ml-1.5 flex-row items-center px-1.5 py-0.5 rounded bg-amber-500/10"
                        >
                          <GraduationCap size={10} color="#F59E0B" />
                          <Text className="text-[10px] font-medium ml-0.5 text-amber-600">
                            Assign
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {canRemoveKeiki(keiki.id) ? (
                    <Pressable
                      onPress={() => handleRemoveKeiki(keiki.id)}
                      className="p-1"
                    >
                      <Trash2 size={12} color="#EF4444" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Members',
          headerStyle: { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
          headerBackTitle: '',
          headerBackVisible: true,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
        {/* Search and Filter */}
        <View className={cn('px-4 pb-4', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn(
              'flex-row items-center px-4 py-3 rounded-xl mb-3',
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            )}
          >
            <Search size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <TextInput
              className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
              placeholder="Search members..."
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              cursorColor={isDark ? '#FFFFFF' : '#000000'}
              selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
            />
          </View>

          {/* Filter Tabs */}
          <View className="flex-row gap-2">
            {(['all', 'instructor', 'student'] as const).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => {
                  setSelectedFilter(filter);
                  if (filter === 'instructor') setSelectedClassFilter(null);
                }}
                className={cn(
                  'px-4 py-2 rounded-full',
                  selectedFilter === filter
                    ? ''
                    : isDark
                      ? 'bg-gray-800'
                      : 'bg-gray-100'
                )}
                style={selectedFilter === filter ? { backgroundColor: theme.primary } : undefined}
              >
                <Text
                  className={cn(
                    'font-medium capitalize',
                    selectedFilter === filter
                      ? 'text-white'
                      : isDark
                        ? 'text-gray-300'
                        : 'text-gray-600'
                  )}
                >
                  {filter === 'all' ? `All (${halauMembers.filter((m) => !m.isKeiki).length})` : filter}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Class Level Filter Chips - teachers only, visible for all/student filters */}
          {showClassFilterRow && (
            <View className="flex-row flex-wrap gap-1.5 mt-2">
              {classLevels.map((level) => {
                const isActive = selectedClassFilter === level.value;
                return (
                  <Pressable
                    key={level.id}
                    onPress={() => setSelectedClassFilter(isActive ? null : level.value)}
                    className={cn(
                      'px-3 py-1 rounded-full flex-row items-center',
                      isActive
                        ? ''
                        : isDark
                          ? 'bg-gray-800'
                          : 'bg-gray-100'
                    )}
                    style={isActive ? { backgroundColor: '#A855F7' } : undefined}
                  >
                    <GraduationCap size={10} color={isActive ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text
                      className={cn(
                        'text-xs font-medium ml-1',
                        isActive
                          ? 'text-white'
                          : isDark
                            ? 'text-gray-400'
                            : 'text-gray-600'
                      )}
                    >
                      {level.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: s(16), paddingBottom: ms(100) }} keyboardShouldPersistTaps="handled">
          {/* Pending Members & Keiki Needing Assignment Alert */}
          {isTeacher && totalPendingItems > 0 && (
            <Animated.View entering={FadeInDown.delay(0).duration(400)}>
              <Pressable
                onPress={() => router.push('/members/pending' as never)}
                className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-3"
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 bg-amber-500/20 rounded-lg items-center justify-center mr-2.5">
                    <Clock size={16} color="#F59E0B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-amber-700 dark:text-amber-400 font-semibold text-sm">
                      {totalPendingItems} Pending Item{totalPendingItems > 1 ? 's' : ''}
                    </Text>
                    <Text className="text-amber-600/70 dark:text-amber-500/70 text-xs">
                      {pendingMembers.length > 0 && `${pendingMembers.length} approval${pendingMembers.length > 1 ? 's' : ''}`}
                      {pendingMembers.length > 0 && keikiNeedingAssignment.length > 0 && ' • '}
                      {keikiNeedingAssignment.length > 0 && `${keikiNeedingAssignment.length} minor${keikiNeedingAssignment.length > 1 ? 's' : ''} need class`}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#F59E0B" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Pending Class Designations Alert */}
          {isTeacher && membersNeedingClass.length > 0 && (
            <Animated.View entering={FadeInDown.delay(50).duration(400)}>
              <View
                className="bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2.5 mb-3"
              >
                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 bg-purple-500/20 rounded-lg items-center justify-center mr-2.5">
                    <GraduationCap size={16} color="#A855F7" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-purple-700 dark:text-purple-400 font-semibold text-sm">
                      {membersNeedingClass.length} Need{membersNeedingClass.length === 1 ? 's' : ''} Class Assignment
                    </Text>
                    <Text className="text-purple-600/70 dark:text-purple-500/70 text-xs">
                      Tap member below to set class level
                    </Text>
                  </View>
                </View>
                <View className="gap-1.5">
                  {membersNeedingClass.slice(0, 3).map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() => handleOpenClassAssignment(member)}
                      className={cn(
                        'flex-row items-center px-2.5 py-2 rounded-lg',
                        isDark ? 'bg-gray-800/60' : 'bg-white/80'
                      )}
                    >
                      <View className="w-6 h-6 rounded-full bg-purple-500/20 items-center justify-center mr-2">
                        <Text className="text-purple-600 font-bold text-xs">
                          {member.firstName[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <Text className={cn('flex-1 font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                        {member.firstName} {member.lastName}
                      </Text>
                      <Text className="text-purple-600 text-xs font-medium">Assign</Text>
                    </Pressable>
                  ))}
                  {membersNeedingClass.length > 3 && (
                    <Text className="text-purple-600/70 dark:text-purple-500/70 text-xs text-center mt-0.5">
                      +{membersNeedingClass.length - 3} more in member list below
                    </Text>
                  )}
                </View>
              </View>
            </Animated.View>
          )}

          {/* My Keiki Quick Add */}
          {myKeiki.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(75).duration(400)}>
              <View
                className={cn(
                  'flex-row items-center px-4 py-4 rounded-xl mb-3',
                  isDark ? 'bg-pink-500/10' : 'bg-pink-50'
                )}
              >
                <View className="w-10 h-10 bg-pink-400 rounded-full items-center justify-center mr-3">
                  <Baby size={20} color="white" />
                </View>
                <View className="flex-1">
                  <Text className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                    {myKeiki.length} Minor{myKeiki.length > 1 ? 's' : ''} Registered
                  </Text>
                  <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Shown under your name below
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowAddKeikiModal(true)}
                  className="flex-row items-center px-3 py-2 rounded-lg bg-pink-400/20"
                >
                  <Plus size={14} color="#F472B6" />
                  <Text className="text-pink-500 font-semibold text-sm ml-1">Add</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(75).duration(400)}>
              <Pressable
                onPress={() => setShowAddKeikiModal(true)}
                className={cn(
                  'flex-row items-center px-4 py-4 rounded-xl mb-3 border border-dashed',
                  isDark ? 'border-pink-400/50 bg-pink-400/5' : 'border-pink-300 bg-pink-50'
                )}
              >
                <View className="w-10 h-10 bg-pink-400/20 rounded-full items-center justify-center mr-3">
                  <Baby size={20} color="#F472B6" />
                </View>
                <View className="flex-1">
                  <Text className={cn('font-semibold text-sm', isDark ? 'text-pink-300' : 'text-pink-600')}>
                    Add Your Minor
                  </Text>
                  <Text className={cn('text-xs', isDark ? 'text-pink-400/70' : 'text-pink-500/70')}>
                    Register your child for classes and events
                  </Text>
                </View>
                <Plus size={20} color="#F472B6" />
              </Pressable>
            </Animated.View>
          )}

          {/* Member List */}
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member, index) => (
              <MemberCard key={member.id} member={member} index={index} />
            ))
          ) : (
            <View className={cn('rounded-2xl p-8 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
              <User size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
              <Text className={cn('mt-4 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {searchQuery ? 'No members match your search' : 'No members yet'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Add Member FAB */}
        {isTeacher && (
          <Pressable
            onPress={() => setShowAddModal(true)}
            className="absolute bottom-24 right-4 w-14 h-14 rounded-full items-center justify-center shadow-lg"
            style={{
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.6 : 0.35,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <Plus size={28} color="white" />
          </Pressable>
        )}

        {/* Add Member Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => setShowAddModal(false)}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Add Member
              </Text>
              <Pressable
                onPress={handleAddMember}
                disabled={!firstName.trim() || !lastName.trim() || !email.trim()}
                className={cn((!firstName.trim() || !lastName.trim() || !email.trim()) && 'opacity-50')}
              >
                <Check size={24} color={theme.primary} />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <View className="gap-4">
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      First Name *
                    </Text>
                    <TextInput
                      className={cn(
                        'px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      placeholder="First"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={firstName}
                      onChangeText={setFirstName}
                      autoCapitalize="words"
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Last Name *
                    </Text>
                    <TextInput
                      className={cn(
                        'px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      placeholder="Last"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={lastName}
                      onChangeText={setLastName}
                      autoCapitalize="words"
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Email *
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="email@example.com"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Phone
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="(123)456-7890"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={phone}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '').slice(0, 10);
                      if (digits.length === 0) { setPhone(''); return; }
                      if (digits.length <= 3) { setPhone(`(${digits}`); return; }
                      if (digits.length <= 6) { setPhone(`(${digits.slice(0, 3)})${digits.slice(3)}`); return; }
                      setPhone(`(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`);
                    }}
                    keyboardType="phone-pad"
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Role
                  </Text>
                  <View className="flex-row gap-2">
                    {(['student', 'instructor'] as UserRole[]).map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => setRole(r)}
                        className={cn(
                          'flex-1 py-3 rounded-xl items-center',
                          role === r ? '' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                        style={role === r ? { backgroundColor: theme.primary } : undefined}
                      >
                        <Text
                          className={cn(
                            'font-medium capitalize',
                            role === r ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                          )}
                        >
                          {r}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Membership Plan
                  </Text>
                  <View className="flex-row gap-2">
                    {(['monthly', 'annual'] as MembershipPlan[]).map((plan) => (
                      <Pressable
                        key={plan}
                        onPress={() => setMembershipPlan(plan)}
                        className={cn(
                          'flex-1 py-3 rounded-xl items-center',
                          membershipPlan === plan ? '' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                        style={membershipPlan === plan ? { backgroundColor: theme.primary } : undefined}
                      >
                        <Text
                          className={cn(
                            'font-medium capitalize',
                            membershipPlan === plan ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                          )}
                        >
                          {plan}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {role === 'student' && (
                  <View>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Class Level
                    </Text>
                    <View className="gap-2">
                      {classLevels.map((level) => (
                        <Pressable
                          key={level.value}
                          onPress={() => setNewMemberClass(level.value)}
                          className={cn(
                            'flex-row items-center p-3 rounded-xl border',
                            newMemberClass === level.value
                              ? 'border-purple-500 bg-purple-500/10'
                              : isDark
                                ? 'border-gray-700 bg-gray-800'
                                : 'border-gray-200 bg-gray-100'
                          )}
                        >
                          <GraduationCap
                            size={20}
                            color={newMemberClass === level.value ? '#A855F7' : isDark ? '#6B7280' : '#9CA3AF'}
                          />
                          <View className="ml-3 flex-1">
                            <Text
                              className={cn(
                                'font-medium',
                                newMemberClass === level.value
                                  ? 'text-purple-600'
                                  : isDark
                                    ? 'text-white'
                                    : 'text-gray-900'
                              )}
                            >
                              {level.label}
                            </Text>
                            <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                              {level.description}
                            </Text>
                          </View>
                          {newMemberClass === level.value ? (
                            <Check size={18} color="#A855F7" />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Class Assignment Modal */}
        <Modal visible={showClassModal} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/50">
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 16, maxHeight: '80%' }}
            >
              <View className="p-5">
                <View className="flex-row items-center justify-between mb-4">
                  <Pressable onPress={() => setShowClassModal(false)}>
                    <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </Pressable>
                  <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                    Set Class Level
                  </Text>
                  <View style={{ width: 24 }} />
                </View>

                {selectedMemberForClass ? (
                  <View className="mb-4 items-center">
                    <View className="w-16 h-16 rounded-full bg-purple-500/20 items-center justify-center mb-2">
                      <Text className="text-purple-600 font-bold text-2xl">
                        {selectedMemberForClass.firstName[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      {selectedMemberForClass.firstName} {selectedMemberForClass.lastName}
                    </Text>
                  </View>
                ) : null}

                <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                  <View className="gap-2 mb-4">
                    {classLevels.map((level) => {
                      const isCustomLevel = !['minor', 'beginner', 'intermediate', 'advanced'].includes(level.id);
                      return (
                        <View key={level.value} className="flex-row items-center">
                          <Pressable
                            onPress={() => setSelectedClass(level.value)}
                            className={cn(
                              'flex-1 flex-row items-center p-4 rounded-xl border-2',
                              selectedClass === level.value
                                ? 'border-purple-500 bg-purple-500/10'
                                : isDark
                                  ? 'border-gray-700 bg-gray-800'
                                  : 'border-gray-200 bg-gray-50'
                            )}
                          >
                            <GraduationCap
                              size={24}
                              color={selectedClass === level.value ? '#A855F7' : isDark ? '#6B7280' : '#9CA3AF'}
                            />
                            <View className="ml-3 flex-1">
                              <Text
                                className={cn(
                                  'font-semibold text-base',
                                  selectedClass === level.value
                                    ? 'text-purple-600'
                                    : isDark
                                      ? 'text-white'
                                      : 'text-gray-900'
                                )}
                              >
                                {level.label}
                              </Text>
                              {level.description ? (
                                <Text className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-500')}>
                                  {level.description}
                                </Text>
                              ) : null}
                            </View>
                            {selectedClass === level.value ? (
                              <Check size={20} color="#A855F7" />
                            ) : null}
                          </Pressable>
                          {/* Edit button for all levels, Delete only for custom levels */}
                          {isTeacher && (
                            <View className="flex-row ml-2">
                              <Pressable
                                onPress={() => handleOpenRenameModal(level)}
                                className="p-2"
                              >
                                <Edit3 size={18} color="#A855F7" />
                              </Pressable>
                              {isCustomLevel && (
                                <Pressable
                                  onPress={() => handleDeleteClassLevel(level.id)}
                                  className="p-2"
                                >
                                  <Trash2 size={18} color="#EF4444" />
                                </Pressable>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Inline Rename Class Level Form */}
                {isTeacher && classToRename && (
                  <View className={cn('rounded-xl p-4 mb-4 border', isDark ? 'border-blue-500/30 bg-blue-500/10' : 'border-blue-200 bg-blue-50')}>
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className={cn('text-sm font-semibold', isDark ? 'text-blue-400' : 'text-blue-700')}>
                        Edit Class Level
                      </Text>
                      <Pressable onPress={() => {
                        setClassToRename(null);
                        setRenameClassLabel('');
                        setRenameClassDescription('');
                      }}>
                        <X size={18} color={isDark ? '#60A5FA' : '#2563EB'} />
                      </Pressable>
                    </View>
                    <View className="gap-3 mb-4">
                      <TextInput
                        className={cn(
                          'px-4 py-3 rounded-xl text-base',
                          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                        )}
                        placeholder="Level name"
                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        value={renameClassLabel}
                        onChangeText={setRenameClassLabel}
                        autoCapitalize="words"
                        autoFocus
                      />
                      <TextInput
                        className={cn(
                          'px-4 py-3 rounded-xl text-base',
                          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                        )}
                        placeholder="Description (optional)"
                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        value={renameClassDescription}
                        onChangeText={setRenameClassDescription}
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => {
                          setClassToRename(null);
                          setRenameClassLabel('');
                          setRenameClassDescription('');
                        }}
                        className={cn(
                          'flex-1 py-3 rounded-xl items-center',
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        )}
                      >
                        <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleRenameClassLevel}
                        disabled={!renameClassLabel.trim()}
                        className={cn(
                          'flex-1 py-3 rounded-xl items-center',
                          renameClassLabel.trim() ? 'bg-blue-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                        )}
                      >
                        <Text className={cn('font-medium', renameClassLabel.trim() ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-400')}>
                          Save Changes
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Add Class Level Section - Inline form instead of popup */}
                {isTeacher && !isAddingClassLevel && !classToRename && (
                  <Pressable
                    onPress={() => setIsAddingClassLevel(true)}
                    className={cn(
                      'flex-row items-center justify-center py-3 rounded-xl mb-4 border-2 border-dashed',
                      isDark ? 'border-purple-500/50' : 'border-purple-300'
                    )}
                  >
                    <Plus size={18} color="#A855F7" />
                    <Text className="text-purple-600 font-medium ml-2">Add Class Level</Text>
                  </Pressable>
                )}

                {/* Inline Add Class Level Form */}
                {isTeacher && isAddingClassLevel && (
                  <View className={cn('rounded-xl p-4 mb-4 border', isDark ? 'border-purple-500/30 bg-purple-500/10' : 'border-purple-200 bg-purple-50')}>
                    <Text className={cn('text-sm font-semibold mb-3', isDark ? 'text-purple-400' : 'text-purple-700')}>
                      New Class Level
                    </Text>
                    <View className="gap-3 mb-4">
                      <TextInput
                        className={cn(
                          'px-4 py-3 rounded-xl text-base',
                          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                        )}
                        placeholder="Level name (e.g., Expert)"
                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        value={newClassLabel}
                        onChangeText={setNewClassLabel}
                        autoCapitalize="words"
                        autoFocus
                      />
                      <TextInput
                        className={cn(
                          'px-4 py-3 rounded-xl text-base',
                          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                        )}
                        placeholder="Description (optional)"
                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        value={newClassDescription}
                        onChangeText={setNewClassDescription}
                      />
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => {
                          setIsAddingClassLevel(false);
                          setNewClassLabel('');
                          setNewClassDescription('');
                        }}
                        className={cn(
                          'flex-1 py-3 rounded-xl items-center',
                          isDark ? 'bg-gray-700' : 'bg-gray-200'
                        )}
                      >
                        <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleAddClassLevel}
                        disabled={!newClassLabel.trim()}
                        className={cn(
                          'flex-1 py-3 rounded-xl items-center',
                          newClassLabel.trim() ? 'bg-purple-500' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                        )}
                      >
                        <Text className={cn('font-medium', newClassLabel.trim() ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-400')}>
                          Add Level
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                <Pressable
                  onPress={handleAssignClass}
                  className="bg-purple-500 py-4 rounded-xl items-center"
                >
                  <Text className="text-white font-bold text-base">
                    {selectedMemberForClass?.classLevel ? 'Update Class Level' : 'Set Class Level'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>


        {/* Add Minor Modal */}
        <Modal visible={showAddKeikiModal} animationType="slide" transparent>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <View className="flex-1 justify-end bg-black/50">
              <View
                className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
                style={{ paddingBottom: insets.bottom + 16 }}
              >
                <View className="p-5">
                  <View className="flex-row items-center justify-between mb-4">
                    <Pressable onPress={() => setShowAddKeikiModal(false)}>
                      <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </Pressable>
                    <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                      Add Minor
                    </Text>
                    <View style={{ width: 24 }} />
                  </View>

                  <View className="items-center mb-6">
                    <View className="w-20 h-20 rounded-full bg-pink-400/20 items-center justify-center mb-2">
                      <Baby size={36} color="#F472B6" />
                    </View>
                    <Text className={cn('text-sm text-center', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Register your child to participate in classes and events
                    </Text>
                  </View>

                  <View className="gap-4 mb-6">
                    <View>
                      <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        First Name *
                      </Text>
                      <TextInput
                        className={cn(
                          'px-4 py-3 rounded-xl text-base',
                          isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                        )}
                        placeholder="Child's first name"
                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        value={keikiFirstName}
                        onChangeText={setKeikiFirstName}
                        autoCapitalize="words"
                        cursorColor={isDark ? '#FFFFFF' : '#000000'}
                        selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                      />
                    </View>
                    <View>
                      <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        Last Name *
                      </Text>
                      <TextInput
                        className={cn(
                          'px-4 py-3 rounded-xl text-base',
                          isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                        )}
                        placeholder="Child's last name"
                        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        value={keikiLastName}
                        onChangeText={setKeikiLastName}
                        autoCapitalize="words"
                        cursorColor={isDark ? '#FFFFFF' : '#000000'}
                        selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                      />
                    </View>
                  </View>

                  <Pressable
                    onPress={handleAddKeiki}
                    disabled={!keikiFirstName.trim() || !keikiLastName.trim()}
                    className={cn(
                      'py-4 rounded-xl items-center',
                      keikiFirstName.trim() && keikiLastName.trim()
                        ? 'bg-pink-500'
                        : isDark
                          ? 'bg-gray-700'
                          : 'bg-gray-200'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold text-base',
                        keikiFirstName.trim() && keikiLastName.trim()
                          ? 'text-white'
                          : isDark
                            ? 'text-gray-500'
                            : 'text-gray-400'
                      )}
                    >
                      Add Minor
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Remove Member Confirmation Modal */}
        <Modal visible={showRemoveModal} animationType="fade" transparent>
          <View className="flex-1 justify-center items-center bg-black/60 px-6">
            <View
              className={cn('w-full rounded-3xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Warning Icon */}
              <View className="items-center mb-5">
                <View className="w-16 h-16 rounded-full bg-red-500/10 items-center justify-center mb-4">
                  <AlertTriangle size={32} color="#EF4444" />
                </View>
                <Text className={cn('text-xl font-bold text-center', isDark ? 'text-white' : 'text-gray-900')}>
                  Remove Student?
                </Text>
              </View>

              {/* Member Info */}
              {memberToRemove && (
                <View className={cn('rounded-2xl p-4 mb-5', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <View className="flex-row items-center">
                    <View
                      className="w-12 h-12 rounded-full items-center justify-center mr-3"
                      style={{ backgroundColor: theme.primary }}
                    >
                      <Text className="text-white text-lg font-bold">
                        {memberToRemove.firstName[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
                        {memberToRemove.firstName} {memberToRemove.lastName}
                      </Text>
                      <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {memberToRemove.email}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Warning Text */}
              <Text className={cn('text-center mb-6', isDark ? 'text-gray-400' : 'text-gray-600')}>
                This action cannot be undone. All data associated with this student will be permanently deleted, including:
              </Text>

              <View className={cn('rounded-xl p-4 mb-6', isDark ? 'bg-red-500/10' : 'bg-red-50')}>
                <View className="gap-2">
                  <Text className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>
                    • Attendance records
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>
                    • Payment history and dues
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>
                    • Chat messages
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>
                    • Event RSVPs and participation
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-red-400' : 'text-red-600')}>
                    • Waiver signatures
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setShowRemoveModal(false);
                    setMemberToRemove(null);
                  }}
                  className={cn(
                    'flex-1 py-4 rounded-xl items-center active:opacity-80',
                    isDark ? 'bg-gray-800' : 'bg-gray-200'
                  )}
                >
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-700')}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmRemove}
                  className="flex-1 bg-red-500 py-4 rounded-xl items-center active:opacity-80"
                >
                  <Text className="text-white font-semibold">Remove Student</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Student Limit Upgrade Modal */}
        <Modal visible={showUpgradeModal} animationType="fade" transparent>
          <View className="flex-1 justify-center items-center bg-black/60 px-6">
            <View
              className={cn('w-full rounded-3xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 10,
              }}
            >
              {/* Icon */}
              <View className="items-center mb-5">
                <View className="w-20 h-20 rounded-full bg-violet-500/20 items-center justify-center mb-4">
                  <Users size={40} color="#7c3aed" />
                </View>
                <Text className={cn('text-xl font-bold text-center', isDark ? 'text-white' : 'text-gray-900')}>
                  Student Limit Reached
                </Text>
              </View>

              {/* Info Box */}
              <View className={cn('rounded-2xl p-4 mb-5', isDark ? 'bg-gray-800' : 'bg-violet-50')}>
                <View className="flex-row items-center justify-center mb-2">
                  <Text className={cn('text-3xl font-bold', isDark ? 'text-violet-400' : 'text-violet-600')}>
                    {studentCount}
                  </Text>
                  <Text className={cn('text-lg mx-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    /
                  </Text>
                  <Text className={cn('text-3xl font-bold', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {maxStudents}
                  </Text>
                </View>
                <Text className={cn('text-center text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Students in your Studio Pro plan
                </Text>
              </View>

              {/* Description */}
              <Text className={cn('text-center mb-6 leading-6', isDark ? 'text-gray-400' : 'text-gray-600')}>
                You've reached the maximum of {maxStudents} students on Studio Pro. Upgrade to Enterprise for unlimited students and additional features.
              </Text>

              {/* Enterprise Features */}
              <View className={cn('rounded-xl p-4 mb-6', isDark ? 'bg-violet-500/10' : 'bg-violet-50')}>
                <Text className={cn('font-semibold mb-3', isDark ? 'text-violet-400' : 'text-violet-700')}>
                  Enterprise includes:
                </Text>
                <View className="gap-2">
                  <View className="flex-row items-center">
                    <Check size={16} color="#7c3aed" />
                    <Text className={cn('ml-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Unlimited students
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Check size={16} color="#7c3aed" />
                    <Text className={cn('ml-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Add admin roles
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Check size={16} color="#7c3aed" />
                    <Text className={cn('ml-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Custom school branding
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Check size={16} color="#7c3aed" />
                    <Text className={cn('ml-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Priority support
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowUpgradeModal(false)}
                  className={cn(
                    'flex-1 py-4 rounded-xl items-center active:opacity-80',
                    isDark ? 'bg-gray-800' : 'bg-gray-200'
                  )}
                >
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-700')}>
                    Maybe Later
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowUpgradeModal(false);
                    router.push('/paywall');
                  }}
                  className="flex-1 bg-violet-600 py-4 rounded-xl items-center active:opacity-80"
                >
                  <View className="flex-row items-center">
                    <Building2 size={18} color="white" />
                    <Text className="text-white font-semibold ml-2">Upgrade</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Promote to Admin Modal */}
        <PromoteAdminModal
          visible={showPromoteModal}
          member={memberToPromote ? {
            id: memberToPromote.id,
            firstName: memberToPromote.firstName,
            lastName: memberToPromote.lastName,
            email: memberToPromote.email,
          } : null}
          onClose={() => { setShowPromoteModal(false); setMemberToPromote(null); }}
          onAbsorbCost={handleAbsorbCost}
          onDelegatePayment={handleDelegatePayment}
        />
      </View>
    </>
  );
}
