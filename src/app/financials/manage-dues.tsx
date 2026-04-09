import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import BackButton from '@/components/BackButton';
import {
  Plus,
  X,
  FileText,
  Check,
  Users,
  Calendar,
  DollarSign,
  Trash2,
  GraduationCap,
  UserCheck,
  Pencil,
  Repeat,
  UserPlus,
  Baby,
  Search,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { DuesCategory, DuesFrequency, RecurringFrequency } from '@/lib/types';

const CATEGORIES: { value: DuesCategory; label: string }[] = [
  { value: 'school_dues', label: 'School Dues' },
  { value: 'performance_dues', label: 'Performance Dues' },
  { value: 'miscellaneous_dues', label: 'Miscellaneous' },
];

const RECURRING_FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
];

// Helper function to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Helper function to parse date string (YYYY-MM-DD) as local date
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function ManageDuesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  // Subscribe directly to organizationDues array to trigger re-renders on changes
  const allOrganizationDues = useAppStore((s) => s.organizationDues);
  const createOrganizationDues = useAppStore((s) => s.createOrganizationDues);
  const updateOrganizationDues = useAppStore((s) => s.updateOrganizationDues);
  const deleteOrganizationDues = useAppStore((s) => s.deleteOrganizationDues);
  const assignDuesToMembers = useAppStore((s) => s.assignDuesToMembers);
  const getMembersByHalau = useAppStore((s) => s.getMembersByHalau);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  const getMemberDuesByHalau = useAppStore((s) => s.getMemberDuesByHalau);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDuesId, setSelectedDuesId] = useState<string | null>(null);
  const [editingDuesId, setEditingDuesId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<DuesCategory>('school_dues');
  const [description, setDescription] = useState('');

  // Assign state
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedClassLevels, setSelectedClassLevels] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [dueDateError, setDueDateError] = useState('');
  const [memberFilterQuery, setMemberFilterQuery] = useState('');

  // Recurring payment state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [recurringEndDate, setRecurringEndDate] = useState('');

  // Computed - filter organization dues by current halau
  const organizationDues = useMemo(() => {
    if (!currentHalauId) return [];
    return allOrganizationDues.filter((d) => d.halauId === currentHalauId);
  }, [currentHalauId, allOrganizationDues]);

  const classLevels = useMemo(() => {
    if (!currentHalauId) return [];
    return getClassLevelsForHalau(currentHalauId);
  }, [currentHalauId, getClassLevelsForHalau, halaus]);

  // Get all members including keiki (minors)
  const allMembers = useMemo(() => {
    if (!currentHalauId) return [];
    return getMembersByHalau(currentHalauId);
  }, [currentHalauId, getMembersByHalau]);

  // Adult members (non-keiki) for class level selection
  const members = useMemo(() => {
    return allMembers.filter((m) => !m.isKeiki);
  }, [allMembers]);

  // Keiki (minors) grouped by their guardian
  const keikiByGuardian = useMemo(() => {
    const keikiMembers = allMembers.filter((m) => m.isKeiki && m.linkedToMemberId);
    const grouped: Record<string, typeof keikiMembers> = {};
    keikiMembers.forEach((keiki) => {
      const guardianId = keiki.linkedToMemberId!;
      if (!grouped[guardianId]) {
        grouped[guardianId] = [];
      }
      grouped[guardianId].push(keiki);
    });
    return grouped;
  }, [allMembers]);

  // Get guardian member by ID
  const getGuardianMember = (guardianId: string) => {
    return allMembers.find((m) => m.id === guardianId);
  };

  // Get all assignable members (adults + keiki) filtered by selected class levels
  const membersByClassLevel = useMemo(() => {
    if (selectedClassLevels.length === 0) return [];
    // Match by both id and value since members may store either
    const selectedLevelValues = classLevels
      .filter((l) => selectedClassLevels.includes(l.id))
      .flatMap((l) => [l.id, l.value]);
    // Include both adult members and keiki in class level filtering
    return allMembers.filter((m) => m.classLevel && selectedLevelValues.includes(m.classLevel));
  }, [allMembers, selectedClassLevels, classLevels]);

  // Get count of all assignable members (adults + keiki) per class level
  const memberCountByClassLevel = useMemo(() => {
    const counts: Record<string, number> = {};
    classLevels.forEach((level) => {
      // Count all members (including keiki) matching either id or value
      counts[level.id] = allMembers.filter(
        (m) => m.classLevel === level.id || m.classLevel === level.value
      ).length;
    });
    return counts;
  }, [allMembers, classLevels]);

  // Filter members list in the assign modal by search query
  const filteredMembers = useMemo(() => {
    if (!memberFilterQuery.trim()) return members;
    const q = memberFilterQuery.toLowerCase();
    return members.filter((m) =>
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  }, [members, memberFilterQuery]);

  // Get all member dues for the halau
  const allMemberDues = useMemo(() => {
    if (!currentHalauId) return [];
    return getMemberDuesByHalau(currentHalauId);
  }, [currentHalauId, getMemberDuesByHalau]);

  // Get members currently assigned to the editing dues template
  const assignedMemberIds = useMemo(() => {
    if (!editingDuesId) return [];
    // Get unique member IDs that have been assigned this dues template
    const memberIds = allMemberDues
      .filter((md) => md.duesId === editingDuesId)
      .map((md) => md.memberId);
    return [...new Set(memberIds)];
  }, [editingDuesId, allMemberDues]);

  // Get assigned members with their details
  const assignedMembers = useMemo(() => {
    return members.filter((m) => assignedMemberIds.includes(m.id));
  }, [members, assignedMemberIds]);

  // Get members previously assigned to the selected dues template (for assign modal)
  const previouslyAssignedMemberIds = useMemo(() => {
    if (!selectedDuesId) return [];
    // Get unique member IDs that have been assigned this dues template
    const memberIds = allMemberDues
      .filter((md) => md.duesId === selectedDuesId)
      .map((md) => md.memberId);
    return [...new Set(memberIds)];
  }, [selectedDuesId, allMemberDues]);

  const resetForm = () => {
    setName('');
    setAmount('');
    setCategory('school_dues');
    setDescription('');
    setEditingDuesId(null);
    setIsRecurring(false);
    setRecurringFrequency('monthly');
  };

  const handleOpenEdit = (duesId: string) => {
    const dues = organizationDues.find((d) => d.id === duesId);
    if (!dues) return;

    setEditingDuesId(duesId);
    setName(dues.name);
    setAmount(dues.amount.toString());
    setCategory(dues.category as DuesCategory);
    setDescription(dues.description || '');
    setIsRecurring(dues.isRecurring || false);
    setRecurringFrequency(dues.recurringFrequency || 'monthly');
    setShowCreateModal(true);
  };

  const handleSaveDues = () => {
    if (!currentHalauId) return;
    if (!name.trim() || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate category
    // (no custom category required — Miscellaneous covers open-ended dues)

    // Strict numeric validation: only allow digits with optional 2-decimal places
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      Alert.alert('Error', 'Please enter a valid amount (e.g. 25 or 25.00)');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const finalCategory = category;

    // Derive frequency from isRecurring state
    const derivedFrequency: DuesFrequency = isRecurring ? (recurringFrequency as DuesFrequency) : 'one_time';

    try {
      if (editingDuesId) {
        // Update existing dues
        updateOrganizationDues(editingDuesId, {
          name: name.trim(),
          amount: parsedAmount,
          frequency: derivedFrequency,
          category: finalCategory,
          description: description.trim() || undefined,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
        });
      } else {
        // Create new dues
        createOrganizationDues({
          halauId: currentHalauId,
          name: name.trim(),
          amount: parsedAmount,
          frequency: derivedFrequency,
          category: finalCategory,
          description: description.trim() || undefined,
          isActive: true,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency : undefined,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', editingDuesId ? 'Failed to update dues' : 'Failed to create dues');
    }
  };

  const handleDeleteDues = (id: string) => {
    // Check if there are any member dues assigned to this organization dues template
    const allMemberDues = currentHalauId ? getMemberDuesByHalau(currentHalauId) : [];
    const assignedMemberDues = allMemberDues.filter((md) => md.duesId === id);
    const hasAssignedMembers = assignedMemberDues.length > 0;

    if (hasAssignedMembers) {
      // Show detailed warning about assigned members
      Alert.alert(
        'Delete Payment Template',
        `This payment has ${assignedMemberDues.length} student${assignedMemberDues.length > 1 ? 's' : ''} or guardian${assignedMemberDues.length > 1 ? 's' : ''} assigned.\n\nDeleting this entry will:\n\n• Remove all assigned payments from the financials list\n• Remove payment notifications from ALL users' dashboards\n• This action cannot be undone\n\nAre you sure you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Anyway',
            style: 'destructive',
            onPress: () => {
              try {
                deleteOrganizationDues(id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete payment template');
              }
            },
          },
        ]
      );
    } else {
      // No assigned members, simple delete confirmation
      Alert.alert(
        'Delete Payment Template',
        'Are you sure you want to delete this payment template?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              try {
                deleteOrganizationDues(id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (error) {
                Alert.alert('Error', 'Failed to delete payment template');
              }
            },
          },
        ]
      );
    }
  };

  const handleOpenAssign = (duesId: string) => {
    setSelectedDuesId(duesId);
    setSelectedMembers([]);
    setSelectedClassLevels([]);
    setDueDate('');
    setDueDateInput('');
    setDueDateError('');
    setMemberFilterQuery('');
    setShowAssignModal(true);
  };

  const handleAssignDues = () => {
    // Combine members from selected class levels with individually selected members
    const classLevelMembers = membersByClassLevel.map((m) => m.id);
    const allSelectedMembers = [...new Set([...classLevelMembers, ...selectedMembers])];

    if (!dueDate) {
      setDueDateError('Due date is required');
      return;
    }
    if (!selectedDuesId || allSelectedMembers.length === 0) {
      Alert.alert('Error', 'Please select class levels or members');
      return;
    }

    try {
      // Get recurring settings from the organization dues template
      const orgDues = organizationDues.find((d) => d.id === selectedDuesId);
      const recurringOptions = orgDues?.isRecurring && orgDues?.recurringFrequency
        ? { isRecurring: true, frequency: orgDues.recurringFrequency }
        : undefined;

      assignDuesToMembers(selectedDuesId, allSelectedMembers, dueDate, recurringOptions);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAssignModal(false);
      setSelectedDuesId(null);
      setSelectedMembers([]);
      setSelectedClassLevels([]);

      // Navigate to financials page to show the newly created payment(s)
      router.replace('/financials?tab=dues');
    } catch (error) {
      Alert.alert('Error', 'Failed to assign dues');
    }
  };

  const toggleClassLevelSelection = (levelId: string) => {
    setSelectedClassLevels((prev) =>
      prev.includes(levelId)
        ? prev.filter((id) => id !== levelId)
        : [...prev, levelId]
    );
  };

  const selectAllClassLevels = () => {
    if (selectedClassLevels.length === classLevels.length) {
      setSelectedClassLevels([]);
    } else {
      setSelectedClassLevels(classLevels.map((l) => l.id));
    }
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAllMembers = () => {
    if (selectedMembers.length === members.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map((m) => m.id));
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
            Set Up Payments
          </Text>

          <View className="w-10" />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 20 }}
      >
        {organizationDues.length === 0 ? (
          <View className={cn('p-8 rounded-2xl items-center', isDark ? 'bg-gray-900' : 'bg-white')}>
            <FileText size={48} color={isDark ? '#374151' : '#D1D5DB'} />
            <Text className={cn('mt-3 font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
              No dues templates created
            </Text>
            <Text className={cn('text-sm text-center mt-1', isDark ? 'text-gray-600' : 'text-gray-400')}>
              Create a dues template to start collecting payments
            </Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="mt-4 px-6 py-3 rounded-full"
              style={{ backgroundColor: theme.primary }}
            >
              <Text className="text-white font-semibold">Create Dues Template</Text>
            </Pressable>
          </View>
        ) : (
          organizationDues.map((dues, index) => (
            <Animated.View
              key={dues.id}
              entering={FadeInUp.delay(index * 50).duration(300)}
            >
              <View
                className={cn(
                  'p-4 rounded-2xl mb-3',
                  isDark ? 'bg-gray-900' : 'bg-white'
                )}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: isDark ? 0.4 : 0.1,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-1">
                    <Text className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                      {dues.name}
                    </Text>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      {dues.category === 'custom' ? dues.customCategory : CATEGORIES.find((c) => c.value === dues.category)?.label} • {dues.isRecurring ? RECURRING_FREQUENCIES.find((f) => f.value === dues.recurringFrequency)?.label : 'One Time'}
                    </Text>
                    {dues.description && (
                      <Text className={cn('text-sm mt-1', isDark ? 'text-gray-500' : 'text-gray-500')}>
                        {dues.description}
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: theme.primary }} className="font-bold text-xl">
                    ${dues.amount.toFixed(2)}
                  </Text>
                </View>

                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleOpenEdit(dues.id);
                    }}
                    className={cn(
                      'w-12 items-center justify-center rounded-xl',
                      isDark ? 'bg-gray-800' : 'bg-gray-100'
                    )}
                  >
                    <Pencil size={18} color={theme.primary} />
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleOpenAssign(dues.id);
                    }}
                    className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Users size={18} color="#FFFFFF" />
                    <Text className="text-white font-semibold ml-2">Assign</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleDeleteDues(dues.id);
                    }}
                    className={cn(
                      'w-12 items-center justify-center rounded-xl',
                      isDark ? 'bg-red-500/20' : 'bg-red-50'
                    )}
                  >
                    <Trash2 size={18} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Floating Action Button - Create Dues */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setShowCreateModal(true);
        }}
        className="absolute w-14 h-14 rounded-full items-center justify-center shadow-lg"
        style={{
          backgroundColor: theme.primary,
          bottom: insets.bottom + 20,
          right: 20,
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.6 : 0.35,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <Plus size={28} color="#FFFFFF" />
      </Pressable>

      {/* Create/Edit Dues Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 20 }}
            >
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
                <Pressable onPress={() => { setShowCreateModal(false); resetForm(); }}>
                  <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  {editingDuesId ? 'Edit Dues Template' : 'Create Dues Template'}
                </Text>
                <Pressable onPress={handleSaveDues}>
                  <Text style={{ color: theme.primary }} className="font-semibold">Save</Text>
                </Pressable>
              </View>

              <ScrollView className="px-5 pt-4" style={{ maxHeight: 500 }} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  Name *
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., Monthly Tuition"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  className={cn(
                    'p-4 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                />
              </View>

              {/* Amount */}
              <View className="mb-4">
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
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                  />
                </View>
              </View>

              {/* Category */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  Category
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat.value}
                      onPress={() => setCategory(cat.value)}
                      className={cn(
                        'px-4 py-2 rounded-full',
                        category !== cat.value && (isDark ? 'bg-gray-800' : 'bg-gray-100')
                      )}
                      style={category === cat.value ? { backgroundColor: theme.primary } : undefined}
                    >
                      <Text
                        className={cn(
                          'font-medium',
                          category === cat.value
                            ? 'text-white'
                            : isDark
                            ? 'text-gray-300'
                            : 'text-gray-700'
                        )}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

              </View>

              {/* Frequency */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  Frequency
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsRecurring(false);
                    }}
                    className={cn(
                      'flex-1 py-3 rounded-xl items-center',
                      isRecurring && (isDark ? 'bg-gray-800' : 'bg-gray-100')
                    )}
                    style={!isRecurring ? { backgroundColor: theme.primary } : undefined}
                  >
                    <Text
                      className={cn(
                        'font-medium',
                        !isRecurring
                          ? 'text-white'
                          : isDark
                          ? 'text-gray-300'
                          : 'text-gray-700'
                      )}
                    >
                      One Time
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setIsRecurring(true);
                    }}
                    className={cn(
                      'flex-1 py-3 rounded-xl items-center',
                      !isRecurring && (isDark ? 'bg-gray-800' : 'bg-gray-100')
                    )}
                    style={isRecurring ? { backgroundColor: theme.primary } : undefined}
                  >
                    <Text
                      className={cn(
                        'font-medium',
                        isRecurring
                          ? 'text-white'
                          : isDark
                          ? 'text-gray-300'
                          : 'text-gray-700'
                      )}
                    >
                      Recurring Payment
                    </Text>
                  </Pressable>
                </View>
                {isRecurring && (
                  <View className="mt-3">
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Repeat Every
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {RECURRING_FREQUENCIES.map((freq) => (
                        <Pressable
                          key={freq.value}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setRecurringFrequency(freq.value);
                          }}
                          className={cn(
                            'flex-1 py-3 rounded-xl items-center min-w-[45%]',
                            recurringFrequency !== freq.value && (isDark ? 'bg-gray-800' : 'bg-gray-100')
                          )}
                          style={recurringFrequency === freq.value ? { backgroundColor: theme.primary } : undefined}
                        >
                          <Text
                            className={cn(
                              'font-medium text-sm',
                              recurringFrequency === freq.value
                                ? 'text-white'
                                : isDark
                                ? 'text-gray-300'
                                : 'text-gray-700'
                            )}
                          >
                            {freq.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  Description (optional)
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add a description..."
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  className={cn(
                    'p-4 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  style={{ textAlignVertical: 'top', minHeight: 80 }}
                />
              </View>

              {/* Currently Assigned Members (only show when editing) */}
              {editingDuesId && (
                <View className="mb-4">
                  <View className="flex-row items-center mb-3">
                    <Users size={18} color={theme.primary} />
                    <Text className={cn('text-sm font-semibold ml-2', isDark ? 'text-white' : 'text-gray-900')}>
                      Currently Assigned
                    </Text>
                  </View>

                  {assignedMembers.length > 0 ? (
                    <>
                      <Text className={cn('text-xs mb-3', isDark ? 'text-gray-500' : 'text-gray-500')}>
                        {assignedMembers.length} member{assignedMembers.length !== 1 ? 's' : ''} currently assigned to this dues template.
                      </Text>
                      <View className={cn('rounded-xl overflow-hidden', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                        {assignedMembers.slice(0, 5).map((member, index) => {
                          const classLevelLabel = classLevels.find(
                            (l) => l.id === member.classLevel || l.value === member.classLevel
                          )?.label;
                          return (
                            <View
                              key={member.id}
                              className={cn(
                                'flex-row items-center p-3',
                                index !== Math.min(assignedMembers.length - 1, 4) && (isDark ? 'border-b border-gray-700' : 'border-b border-gray-200')
                              )}
                            >
                              <View
                                className="w-8 h-8 rounded-full items-center justify-center mr-3"
                                style={{ backgroundColor: `${theme.primary}20` }}
                              >
                                <Text style={{ color: theme.primary }} className="font-bold text-sm">
                                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                </Text>
                              </View>
                              <View className="flex-1">
                                <Text className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                                  {member.firstName} {member.lastName}
                                </Text>
                                {classLevelLabel && (
                                  <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                    {classLevelLabel}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                        {assignedMembers.length > 5 && (
                          <View className={cn('p-3', isDark ? 'bg-gray-700/50' : 'bg-gray-200/50')}>
                            <Text className={cn('text-xs text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                              +{assignedMembers.length - 5} more member{assignedMembers.length - 5 !== 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Assign More Button */}
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setShowCreateModal(false);
                          handleOpenAssign(editingDuesId);
                        }}
                        className={cn(
                          'flex-row items-center justify-center py-3 rounded-xl mt-3',
                          isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                        style={{ borderWidth: 1, borderColor: theme.primary, borderStyle: 'dashed' }}
                      >
                        <UserPlus size={18} color={theme.primary} />
                        <Text style={{ color: theme.primary }} className="font-medium ml-2">
                          Assign to More Members
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <View
                      className={cn('p-4 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                    >
                      <Users size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                      <Text className={cn('text-sm mt-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        No members assigned yet
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setShowCreateModal(false);
                          handleOpenAssign(editingDuesId);
                        }}
                        className="mt-3 px-4 py-2 rounded-full"
                        style={{ backgroundColor: theme.primary }}
                      >
                        <Text className="text-white font-semibold text-sm">Assign Members</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Sticky Save Button */}
            <View className="px-5 pt-3 pb-2">
              <Pressable
                onPress={handleSaveDues}
                className="py-4 rounded-2xl items-center flex-row justify-center"
                style={{
                  backgroundColor: theme.primary,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.5 : 0.18,
                  shadowRadius: 12,
                  elevation: 10,
                }}
              >
                <Check size={20} color="white" />
                <Text className="text-white font-bold text-base ml-2">
                  {editingDuesId ? 'Save Changes' : 'Create Template'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign Dues Modal */}
      <Modal visible={showAssignModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 20, maxHeight: '80%' }}
            >
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
                <Pressable onPress={() => setShowAssignModal(false)}>
                  <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  Assign Dues
                </Text>
                <Pressable onPress={handleAssignDues}>
                  <Text style={{ color: theme.primary }} className="font-semibold">Assign</Text>
                </Pressable>
              </View>

              <ScrollView className="px-5 pt-4" contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
              {/* Due Date - Manual Entry */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Due Date <Text className="text-red-500">*</Text>
                </Text>
                <View className={cn('px-4 py-3 rounded-xl flex-row items-center', isDark ? 'bg-gray-800' : 'bg-gray-100', dueDateError ? 'border border-red-500' : '')}>
                  <Calendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <TextInput
                    value={dueDateInput}
                    onChangeText={(text) => {
                      // Strip non-digits
                      const digits = text.replace(/\D/g, '');
                      // Auto-insert slashes: mm/dd/yyyy
                      let formatted = digits;
                      if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
                      if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
                      setDueDateInput(formatted);
                      setDueDateError('');
                      // Parse into ISO string when complete
                      if (digits.length === 8) {
                        const mm = parseInt(digits.slice(0, 2), 10);
                        const dd = parseInt(digits.slice(2, 4), 10);
                        const yyyy = parseInt(digits.slice(4, 8), 10);
                        const parsed = new Date(yyyy, mm - 1, dd);
                        if (
                          parsed.getFullYear() === yyyy &&
                          parsed.getMonth() === mm - 1 &&
                          parsed.getDate() === dd
                        ) {
                          setDueDate(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
                        } else {
                          setDueDate('');
                          setDueDateError('Invalid date');
                        }
                      } else {
                        setDueDate('');
                      }
                    }}
                    placeholder="mm/dd/yyyy"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    keyboardType="number-pad"
                    maxLength={10}
                    className={cn('ml-3 text-base font-medium flex-1', isDark ? 'text-white' : 'text-gray-900')}
                  />
                </View>
                {dueDateError ? (
                  <Text className="text-red-500 text-xs mt-1 px-1">{dueDateError}</Text>
                ) : null}
              </View>

              {/* Assign by Class Level (Groups) */}
              <View className="mb-5">
                <View className="flex-row items-center mb-3">
                  <GraduationCap size={18} color={theme.primary} />
                  <Text className={cn('text-sm font-semibold ml-2', isDark ? 'text-white' : 'text-gray-900')}>
                    Assign by Class Level
                  </Text>
                </View>
                <Text className={cn('text-xs mb-3', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  Select class levels to assign dues to all members in those groups. Members without an assigned class level will not be charged.
                </Text>

                <View className="flex-row items-center justify-between mb-2">
                  <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {selectedClassLevels.length} level{selectedClassLevels.length !== 1 ? 's' : ''} selected
                    {selectedClassLevels.length > 0 && ` (${membersByClassLevel.length} member${membersByClassLevel.length !== 1 ? 's' : ''})`}
                  </Text>
                  <Pressable onPress={selectAllClassLevels}>
                    <Text style={{ color: theme.primary }} className="font-medium text-sm">
                      {selectedClassLevels.length === classLevels.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {classLevels.map((level) => {
                    const isSelected = selectedClassLevels.includes(level.id);
                    const memberCount = memberCountByClassLevel[level.id] || 0;
                    return (
                      <Pressable
                        key={level.id}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          toggleClassLevelSelection(level.id);
                        }}
                        className={cn(
                          'flex-row items-center px-4 py-3 rounded-xl border',
                          isSelected
                            ? ''
                            : isDark
                            ? 'bg-gray-800 border-gray-700'
                            : 'bg-gray-100 border-gray-200'
                        )}
                        style={isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                      >
                        <View
                          className={cn(
                            'w-5 h-5 rounded items-center justify-center mr-2',
                            !isSelected && (isDark ? 'bg-gray-700' : 'bg-white border border-gray-300')
                          )}
                          style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.3)' } : undefined}
                        >
                          {isSelected && <Check size={12} color="#FFFFFF" />}
                        </View>
                        <View>
                          <Text
                            className={cn(
                              'font-medium text-sm',
                              isSelected ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'
                            )}
                          >
                            {level.label}
                          </Text>
                          <Text
                            className={cn(
                              'text-xs',
                              isSelected ? 'text-white/70' : isDark ? 'text-gray-500' : 'text-gray-500'
                            )}
                          >
                            {memberCount} member{memberCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {classLevels.length === 0 && (
                  <View className={cn('p-4 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      No class levels configured
                    </Text>
                  </View>
                )}
              </View>

              {/* Divider */}
              <View className={cn('h-px mb-5', isDark ? 'bg-gray-800' : 'bg-gray-200')} />

              {/* Select Individual Members */}
              <View className="mb-4">
                <View className="flex-row items-center mb-3">
                  <UserCheck size={18} color={theme.primary} />
                  <Text className={cn('text-sm font-semibold ml-2', isDark ? 'text-white' : 'text-gray-900')}>
                    Assign to Individual Members
                  </Text>
                </View>
                <Text className={cn('text-xs mb-3', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  Select specific members to assign dues to, in addition to class level groups above.
                </Text>

                {/* Search bar */}
                <View className={cn('flex-row items-center px-3 py-2 rounded-xl mb-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <Search size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <TextInput
                    value={memberFilterQuery}
                    onChangeText={setMemberFilterQuery}
                    placeholder="Search members..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    className={cn('flex-1 ml-2 text-sm', isDark ? 'text-white' : 'text-gray-900')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {memberFilterQuery.length > 0 && (
                    <Pressable onPress={() => setMemberFilterQuery('')}>
                      <X size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                    </Pressable>
                  )}
                </View>

                <View className="flex-row items-center justify-between mb-2">
                  <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                    {memberFilterQuery.trim() ? ` • ${filteredMembers.length} shown` : ''}
                  </Text>
                  <Pressable onPress={selectAllMembers}>
                    <Text style={{ color: theme.primary }} className="font-medium text-sm">
                      {selectedMembers.length === members.length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                </View>

                {filteredMembers.length === 0 && memberFilterQuery.trim() ? (
                  <View className={cn('p-4 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      No members match "{memberFilterQuery}"
                    </Text>
                  </View>
                ) : (
                  filteredMembers.map((member) => {
                  const isSelectedViaClassLevel = membersByClassLevel.some((m) => m.id === member.id);
                  const isSelected = selectedMembers.includes(member.id);
                  const isPreviouslyAssigned = previouslyAssignedMemberIds.includes(member.id);
                  const classLevelLabel = classLevels.find(
                    (l) => l.id === member.classLevel || l.value === member.classLevel
                  )?.label;
                  const keikiUnderGuardian = keikiByGuardian[member.id] || [];

                  return (
                    <View key={member.id}>
                      <Pressable
                        onPress={() => toggleMemberSelection(member.id)}
                        className={cn(
                          'flex-row items-center p-4 rounded-xl mb-2',
                          isDark ? 'bg-gray-800' : 'bg-gray-100',
                          isSelectedViaClassLevel && 'opacity-60'
                        )}
                      >
                        <View
                          className={cn(
                            'w-6 h-6 rounded-full items-center justify-center mr-3',
                            !(isSelected || isSelectedViaClassLevel) && (isDark
                              ? 'bg-gray-700 border border-gray-600'
                              : 'bg-white border border-gray-300')
                          )}
                          style={(isSelected || isSelectedViaClassLevel) ? { backgroundColor: theme.primary } : undefined}
                        >
                          {(isSelected || isSelectedViaClassLevel) && (
                            <Check size={14} color="#FFFFFF" />
                          )}
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {member.firstName} {member.lastName}
                            </Text>
                            {isPreviouslyAssigned && (
                              <View className={cn('ml-2 px-2 py-0.5 rounded', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                                <Text className={cn('text-xs font-medium', isDark ? 'text-amber-400' : 'text-amber-700')}>
                                  previously assigned
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                            {classLevelLabel || 'No class level'}{isSelectedViaClassLevel ? ' • Selected via class level' : ''}
                            {keikiUnderGuardian.length > 0 && ` • ${keikiUnderGuardian.length} student${keikiUnderGuardian.length !== 1 ? 's' : ''}`}
                          </Text>
                        </View>
                      </Pressable>

                      {/* Keiki (Minors) under this guardian */}
                      {keikiUnderGuardian.length > 0 && (
                        <View className="ml-6 mb-2">
                          {keikiUnderGuardian.map((keiki) => {
                            const isKeikiSelected = selectedMembers.includes(keiki.id);
                            const isKeikiPreviouslyAssigned = previouslyAssignedMemberIds.includes(keiki.id);
                            const keikiClassLevel = classLevels.find(
                              (l) => l.id === keiki.classLevel || l.value === keiki.classLevel
                            )?.label;

                            return (
                              <Pressable
                                key={keiki.id}
                                onPress={() => toggleMemberSelection(keiki.id)}
                                className={cn(
                                  'flex-row items-center p-3 rounded-xl mb-1.5 border-l-2',
                                  isDark ? 'bg-gray-800/60' : 'bg-gray-50',
                                )}
                                style={{ borderLeftColor: theme.primary }}
                              >
                                <View
                                  className={cn(
                                    'w-5 h-5 rounded-full items-center justify-center mr-2.5',
                                    !isKeikiSelected && (isDark
                                      ? 'bg-gray-700 border border-gray-600'
                                      : 'bg-white border border-gray-300')
                                  )}
                                  style={isKeikiSelected ? { backgroundColor: theme.primary } : undefined}
                                >
                                  {isKeikiSelected && (
                                    <Check size={12} color="#FFFFFF" />
                                  )}
                                </View>
                                <Baby size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                <View className="flex-1 ml-2">
                                  <View className="flex-row items-center flex-wrap">
                                    <Text className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                                      {keiki.firstName} {keiki.lastName}
                                    </Text>
                                    {isKeikiPreviouslyAssigned && (
                                      <View className={cn('ml-2 px-1.5 py-0.5 rounded', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                                        <Text className={cn('text-xs font-medium', isDark ? 'text-amber-400' : 'text-amber-700')}>
                                          previously assigned
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                                    {keikiClassLevel || 'No class level'} • Bills to {member.firstName}
                                  </Text>
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })
                )}
              </View>

              {/* Summary */}
              {(selectedClassLevels.length > 0 || selectedMembers.length > 0) && (
                <View
                  className={cn('p-4 rounded-xl mb-4', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                  style={{ borderLeftWidth: 4, borderLeftColor: theme.primary }}
                >
                  <Text className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    Assignment Summary
                  </Text>
                  <Text className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {[...new Set([...membersByClassLevel.map((m) => m.id), ...selectedMembers])].length} total member{[...new Set([...membersByClassLevel.map((m) => m.id), ...selectedMembers])].length !== 1 ? 's' : ''} will be assigned this due
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Sticky Assign Button */}
            <View className="px-5 pt-3 pb-2">
              <Pressable
                onPress={handleAssignDues}
                className="py-4 rounded-2xl items-center flex-row justify-center"
                style={{
                  backgroundColor: theme.primary,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: isDark ? 0.5 : 0.18,
                  shadowRadius: 12,
                  elevation: 10,
                }}
              >
                <UserCheck size={20} color="white" />
                <Text className="text-white font-bold text-base ml-2">Assign Dues</Text>
              </Pressable>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
