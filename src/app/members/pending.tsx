import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { useSubscription } from '@/lib/useSubscription';
import { cn } from '@/lib/cn';
import { Check, X, User, Clock, Mail, GraduationCap, Users, Building2, Baby } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import type { ClassLevel, Member } from '@/lib/types';

export default function PendingMembersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showClassModal, setShowClassModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassLevel>('beginner');

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const members = useAppStore((s) => s.members); // Subscribe to members array for reactivity
  const approveMember = useAppStore((s) => s.approveMember);
  const updateMember = useAppStore((s) => s.updateMember);
  const denyMember = useAppStore((s) => s.denyMember);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  const classLevels = currentHalauId ? getClassLevelsForHalau(currentHalauId) : [
    { value: 'minor', label: 'Minors', description: 'Children\'s class', id: 'minor', order: 0 },
    { value: 'beginner', label: 'Beginner', description: 'New to hula', id: 'beginner', order: 1 },
    { value: 'intermediate', label: 'Intermediate', description: 'Some experience', id: 'intermediate', order: 2 },
    { value: 'advanced', label: 'Advanced', description: 'Experienced dancers', id: 'advanced', order: 3 },
  ];

  // Subscription info for student limits
  const { tier, maxStudents, hasUnlimitedStudents } = useSubscription();

  // Filter members for current halau (computed from members array for reactivity)
  const pendingMembers = currentHalauId
    ? members.filter((m) => m.halauId === currentHalauId && m.status === 'pending')
    : [];
  const halauMembers = currentHalauId
    ? members.filter((m) => m.halauId === currentHalauId && m.status === 'approved')
    : [];

  // Get keiki (minors) that need class assignment (classLevel is empty/null - NOT assigned yet)
  // Once a teacher assigns ANY class level (including 'minor'), the keiki is considered assigned
  const keikiNeedingAssignment = halauMembers.filter(
    (m) => m.isKeiki && (!m.classLevel || m.classLevel === '')
  );

  // Get the guardian for a keiki
  const getGuardianName = (keikiMember: Member) => {
    if (!keikiMember.linkedToMemberId) return null;
    const guardian = halauMembers.find((m) => m.id === keikiMember.linkedToMemberId);
    return guardian ? `${guardian.firstName} ${guardian.lastName}` : null;
  };

  // Calculate current student count (students only)
  const studentCount = halauMembers.filter((m) => m.role === 'student').length;
  const isAtStudentLimit = !hasUnlimitedStudents && maxStudents > 0 && studentCount >= maxStudents;

  const handleStartApproval = (member: Member) => {
    // Check student limit before starting approval process
    if (member.role === 'student' && isAtStudentLimit) {
      setShowUpgradeModal(true);
      return;
    }
    // Guardians don't get assigned a class — approve them directly
    if (member.role === 'guardian') {
      approveMember(member.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    setSelectedMember(member);
    setSelectedClass('beginner');
    setShowClassModal(true);
  };

  const handleConfirmApproval = () => {
    if (!selectedMember) return;

    // For keiki, just update the class level (they're already approved)
    // For regular members, approve and set class level
    if (!selectedMember.isKeiki) {
      approveMember(selectedMember.id);
    }
    updateMember(selectedMember.id, { classLevel: selectedClass });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowClassModal(false);
    setSelectedMember(null);
  };

  const handleDeny = (memberId: string) => {
    denyMember(memberId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Pending & Assignments',
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Pending Member Approvals */}
          {pendingMembers.length > 0 && (
            <View className="mb-4">
              <Text className={cn('text-sm font-semibold mb-3 uppercase tracking-wider', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Pending Approvals ({pendingMembers.length})
              </Text>
              {pendingMembers.map((member, index) => (
                <Animated.View
                  key={member.id}
                  entering={FadeInDown.delay(index * 100).duration(400)}
                >
                  <View
                    className={cn(
                      'rounded-2xl p-4 mb-3',
                      isDark ? 'bg-gray-800/80' : 'bg-white'
                    )}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: isDark ? 0.5 : 0.2,
                      shadowRadius: 6,
                      elevation: isDark ? 6 : 5,
                    }}
                  >
                    <View className="flex-row items-center mb-4">
                      <View className="w-14 h-14 rounded-full bg-gray-400 items-center justify-center mr-4">
                        <User size={28} color="white" />
                      </View>
                      <View className="flex-1">
                        <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.firstName || 'New'} {member.lastName || 'Member'}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <Mail size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                          <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            {member.email}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-center mb-4">
                      <Clock size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                      <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Requested {format(parseISO(member.joinedAt), 'MMM d, yyyy')}
                      </Text>
                    </View>

                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={() => handleDeny(member.id)}
                        className={cn(
                          'flex-1 flex-row items-center justify-center py-3 rounded-xl',
                          isDark ? 'bg-red-500/20' : 'bg-red-50'
                        )}
                      >
                        <X size={20} color="#EF4444" />
                        <Text className="text-red-500 font-semibold ml-2">Deny</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleStartApproval(member)}
                        className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-teal-500"
                      >
                        <Check size={20} color="white" />
                        <Text className="text-white font-semibold ml-2">Approve</Text>
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Minors Needing Class Assignment */}
          {keikiNeedingAssignment.length > 0 && (
            <View className="mb-4">
              <Text className={cn('text-sm font-semibold mb-3 uppercase tracking-wider', isDark ? 'text-pink-400' : 'text-pink-500')}>
                Minors Awaiting Class Assignment ({keikiNeedingAssignment.length})
              </Text>
              {keikiNeedingAssignment.map((keiki, index) => (
                <Animated.View
                  key={keiki.id}
                  entering={FadeInDown.delay((pendingMembers.length + index) * 100).duration(400)}
                >
                  <View
                    className={cn(
                      'rounded-2xl p-4 mb-3 border-l-4 border-pink-400',
                      isDark ? 'bg-gray-800/80' : 'bg-white'
                    )}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: isDark ? 0.5 : 0.2,
                      shadowRadius: 6,
                      elevation: isDark ? 6 : 5,
                    }}
                  >
                    <View className="flex-row items-center mb-3">
                      <View className="w-14 h-14 rounded-full bg-pink-400 items-center justify-center mr-4">
                        <Baby size={28} color="white" />
                      </View>
                      <View className="flex-1">
                        <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                          {keiki.firstName} {keiki.lastName}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <User size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                          <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                            Guardian: {getGuardianName(keiki) || 'Unknown'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row items-center mb-4">
                      <Clock size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                      <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Registered {format(parseISO(keiki.joinedAt), 'MMM d, yyyy')}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => {
                        setSelectedMember(keiki);
                        setSelectedClass('beginner');
                        setShowClassModal(true);
                      }}
                      className="flex-row items-center justify-center py-3 rounded-xl bg-pink-500"
                    >
                      <GraduationCap size={20} color="white" />
                      <Text className="text-white font-semibold ml-2">Set Class Level</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {pendingMembers.length === 0 && keikiNeedingAssignment.length === 0 && (
            <View className={cn('rounded-2xl p-8 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
              <Check size={48} color="#10B981" />
              <Text className={cn('mt-4 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                All caught up! No pending requests or assignments.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Class Level Selection Modal */}
        <Modal visible={showClassModal} animationType="slide" transparent>
          <View className="flex-1 justify-end bg-black/50">
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 16 }}
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

                {selectedMember ? (
                  <View className="mb-4 items-center">
                    {selectedMember.isKeiki && (
                      <View className="w-16 h-16 rounded-full bg-pink-400/20 items-center justify-center mb-2">
                        <Baby size={32} color="#F472B6" />
                      </View>
                    )}
                    <Text className={cn('text-center text-base', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      {selectedMember.isKeiki ? 'Assigning' : 'Approving'} {selectedMember.firstName} {selectedMember.lastName}
                    </Text>
                    {selectedMember.isKeiki && (
                      <Text className={cn('text-center text-sm mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Guardian: {getGuardianName(selectedMember) || 'Unknown'}
                      </Text>
                    )}
                  </View>
                ) : null}

                <View className="gap-2 mb-6">
                  {classLevels.map((level) => (
                    <Pressable
                      key={level.value}
                      onPress={() => setSelectedClass(level.value)}
                      className={cn(
                        'flex-row items-center p-4 rounded-xl border-2',
                        selectedClass === level.value
                          ? 'border-teal-500 bg-teal-500/10'
                          : isDark
                            ? 'border-gray-700 bg-gray-800'
                            : 'border-gray-200 bg-gray-50'
                      )}
                    >
                      <GraduationCap
                        size={24}
                        color={selectedClass === level.value ? '#14B8A6' : isDark ? '#6B7280' : '#9CA3AF'}
                      />
                      <View className="ml-3 flex-1">
                        <Text
                          className={cn(
                            'font-semibold text-base',
                            selectedClass === level.value
                              ? 'text-teal-600'
                              : isDark
                                ? 'text-white'
                                : 'text-gray-900'
                          )}
                        >
                          {level.label}
                        </Text>
                        <Text className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-500')}>
                          {level.description}
                        </Text>
                      </View>
                      {selectedClass === level.value ? (
                        <Check size={20} color="#14B8A6" />
                      ) : null}
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={handleConfirmApproval}
                  className={cn(
                    'py-4 rounded-xl items-center',
                    selectedMember?.isKeiki ? 'bg-pink-500' : 'bg-teal-500'
                  )}
                >
                  <Text className="text-white font-bold text-base">
                    {selectedMember?.isKeiki ? 'Set Class Level' : 'Approve Member'}
                  </Text>
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
      </View>
    </>
  );
}
