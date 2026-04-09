import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, Modal, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import BackButton from '@/components/BackButton';
import {
  Shield,
  Users,
  Edit3,
  CreditCard,
  Calendar,
  Video,
  MessageSquare,
  ChevronRight,
  Crown,
  User,
  UserCog,
  Check,
  X,
  Lock,
  Building2,
  Heart,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Member, UserRole } from '@/lib/types';
import { useSubscription } from '@/lib/useSubscription';

type Permission = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  teacherDefault: boolean;
  adminDefault: boolean;
  studentDefault: boolean;
  guardianDefault: boolean;
};

const PERMISSIONS: Permission[] = [
  {
    id: 'view_members',
    name: 'View Members',
    description: 'Can see the member directory',
    icon: <Users size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: true,
    guardianDefault: true,
  },
  {
    id: 'edit_members',
    name: 'Edit Members',
    description: 'Can modify member information',
    icon: <Edit3 size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: false,
    guardianDefault: false,
  },
  {
    id: 'view_payments',
    name: 'View Payments',
    description: 'Can see payment history',
    icon: <CreditCard size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: false,
    guardianDefault: false,
  },
  {
    id: 'manage_payments',
    name: 'Manage Payments',
    description: 'Can record and edit payments',
    icon: <CreditCard size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: false,
    guardianDefault: false,
  },
  {
    id: 'create_events',
    name: 'Create Events',
    description: 'Can create and edit events',
    icon: <Calendar size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: false,
    guardianDefault: false,
  },
  {
    id: 'view_videos',
    name: 'View Videos',
    description: 'Can access practice videos',
    icon: <Video size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: true,
    guardianDefault: true,
  },
  {
    id: 'upload_videos',
    name: 'Upload Videos',
    description: 'Can upload new videos',
    icon: <Video size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: false,
    guardianDefault: false,
  },
  {
    id: 'manage_chat',
    name: 'Manage Chat',
    description: 'Can create channels and moderate',
    icon: <MessageSquare size={20} color="#0D9488" />,
    teacherDefault: true,
    adminDefault: true,
    studentDefault: false,
    guardianDefault: false,
  },
];

// Separate component for member admin item to ensure proper reactivity
function MemberAdminItem({
  memberId,
  isDark,
  onToggle,
}: {
  memberId: string;
  isDark: boolean;
  onToggle: (id: string) => void;
}) {
  // Subscribe to the member's role specifically
  const memberRole = useAppStore((s) => s.members.find((m) => m.id === memberId)?.role);
  const memberFirstName = useAppStore((s) => s.members.find((m) => m.id === memberId)?.firstName ?? '');
  const memberLastName = useAppStore((s) => s.members.find((m) => m.id === memberId)?.lastName ?? '');
  const memberPhoto = useAppStore((s) => s.members.find((m) => m.id === memberId)?.profilePhoto);

  if (!memberRole) return null;

  const isAdmin = memberRole === 'admin';

  return (
    <Pressable
      onPress={() => onToggle(memberId)}
      className={cn(
        'flex-row items-center px-4 py-3 rounded-xl mb-2 active:opacity-70',
        isAdmin
          ? 'bg-purple-500/20 border border-purple-500/50'
          : isDark ? 'bg-gray-800' : 'bg-gray-100'
      )}
    >
      {memberPhoto ? (
        <Image
          source={{ uri: memberPhoto }}
          className="w-10 h-10 rounded-full mr-3"
        />
      ) : (
        <View
          className={cn(
            'w-10 h-10 rounded-full items-center justify-center mr-3',
            isAdmin ? 'bg-purple-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'
          )}
        >
          {isAdmin ? (
            <UserCog size={20} color="white" />
          ) : (
            <Text className={cn('text-lg font-bold', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {memberFirstName.charAt(0)}
            </Text>
          )}
        </View>
      )}
      <View className="flex-1">
        <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
          {memberFirstName} {memberLastName}
        </Text>
        <Text className={cn('text-xs', isAdmin ? 'text-purple-500' : isDark ? 'text-gray-500' : 'text-gray-400')}>
          {isAdmin ? 'Admin' : 'Student'}
        </Text>
      </View>
      <View
        className={cn(
          'w-6 h-6 rounded-full items-center justify-center border-2',
          isAdmin
            ? 'bg-purple-500 border-purple-500'
            : isDark ? 'border-gray-600' : 'border-gray-300'
        )}
      >
        {isAdmin && <Check size={14} color="white" />}
      </View>
    </Pressable>
  );
}

export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Subscription check
  const { canManagePermissions, canAddAdmins, isLoading: subscriptionLoading, tier } = useSubscription();

  const [selectedRole, setSelectedRole] = useState<'instructor' | 'admin' | 'student' | 'guardian'>('student');
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Store - use stable selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const allMembers = useAppStore((s) => s.members);
  const updateMember = useAppStore((s) => s.updateMember);

  // Derive filtered members from allMembers (this is computed, not a selector)
  const members = React.useMemo(() =>
    currentHalauId ? allMembers.filter((m) => m.halauId === currentHalauId && m.status === 'approved') : [],
    [allMembers, currentHalauId]
  );

  // Local state for permissions (in a real app, this would be stored in the database)
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    PERMISSIONS.forEach((p) => {
      // Teacher/instructor - all permissions ON by default
      initial[`instructor_${p.id}`] = true;
      // Admin - all permissions ON by default
      initial[`admin_${p.id}`] = true;
      // Student - use defined defaults
      initial[`student_${p.id}`] = p.studentDefault;
      // Guardian - use defined defaults (same as student)
      initial[`guardian_${p.id}`] = p.guardianDefault;
    });
    return initial;
  });

  const togglePermission = (permissionId: string) => {
    const key = `${selectedRole}_${permissionId}`;
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    // In a real app, save to database
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Permissions have been updated.');
  };

  const toggleAdminRole = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    const newRole: UserRole = member.role === 'admin' ? 'student' : 'admin';
    updateMember(memberId, { role: newRole });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const teacherCount = members.filter((m) => m.role === 'teacher').length;
  const adminCount = members.filter((m) => m.role === 'admin').length;
  const studentCount = members.filter((m) => m.role === 'student').length;
  const guardianCount = members.filter((m) => m.role === 'guardian').length;

  // Students who can be promoted to admin (excludes teacher)
  const eligibleForAdmin = members.filter((m) => m.role === 'student' || m.role === 'admin');

  // Show upgrade prompt if not Enterprise tier
  if (!subscriptionLoading && !canManagePermissions) {
    return (
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View
          className={cn('px-5 pb-4 border-b', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200')}
          style={{ paddingTop: insets.top + 12 }}
        >
          <View className="flex-row items-center justify-between">
            <BackButton />

            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Permissions
            </Text>

            <View className="w-10" />
          </View>
        </View>

        {/* Upgrade Prompt */}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-violet-500/20 items-center justify-center mb-6">
            <Lock size={40} color="#7c3aed" />
          </View>

          <Text className={cn('text-2xl font-bold text-center mb-3', isDark ? 'text-white' : 'text-gray-900')}>
            Enterprise Feature
          </Text>

          <Text className={cn('text-center mb-8 leading-6', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Permissions management is only available with the Enterprise plan. Upgrade to customize role permissions and add admin users.
          </Text>

          <Pressable
            onPress={() => router.push('/paywall')}
            className="px-8 py-4 rounded-2xl bg-violet-600 active:opacity-80"
          >
            <View className="flex-row items-center">
              <Building2 size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Upgrade to Enterprise</Text>
            </View>
          </Pressable>

          <Text className={cn('text-sm mt-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Current plan: Free
          </Text>
        </View>
      </View>
    );
  }

  if (subscriptionLoading) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        className={cn('px-5 pb-4 border-b', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200')}
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between">
          <BackButton />

          <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Permissions
          </Text>

          <Pressable
            onPress={handleSave}
            className="px-4 py-2 bg-teal-500 rounded-lg active:opacity-80"
          >
            <Text className="text-white font-medium">Save</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5 py-6">
          {/* Admin Role Configuration */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)} className="mb-6">
            <Text className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Admin Role Configuration
            </Text>
            <Pressable
              onPress={() => setShowAdminModal(true)}
              className={cn(
                'flex-row items-center p-4 rounded-2xl active:opacity-80',
                isDark ? 'bg-gray-800' : 'bg-white'
              )}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <View className="w-12 h-12 rounded-xl bg-purple-500/20 items-center justify-center mr-4">
                <UserCog size={24} color="#8B5CF6" />
              </View>
              <View className="flex-1">
                <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
                  Manage Admins
                </Text>
                <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {adminCount} admin{adminCount !== 1 ? 's' : ''} assigned
                </Text>
              </View>
              <ChevronRight size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </Pressable>
            <Text className={cn('text-xs mt-2 px-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Admins have elevated permissions similar to Teachers, helping manage the halau
            </Text>
          </Animated.View>

          {/* Role Selector */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-6">
            <Text className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Configure Role Permissions
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setSelectedRole('instructor')}
                  className={cn(
                    'p-4 rounded-2xl border-2 min-w-[120px]',
                    selectedRole === 'instructor'
                      ? 'border-teal-500 bg-teal-500/10'
                      : isDark
                        ? 'border-gray-700 bg-gray-800'
                        : 'border-gray-200 bg-white'
                  )}
                >
                  <View className="flex-row items-center mb-2">
                    <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center mr-3">
                      <Crown size={20} color="#F59E0B" />
                    </View>
                    <View>
                      <Text className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        Teacher
                      </Text>
                      <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {teacherCount}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedRole('admin')}
                  className={cn(
                    'p-4 rounded-2xl border-2 min-w-[120px]',
                    selectedRole === 'admin'
                      ? 'border-teal-500 bg-teal-500/10'
                      : isDark
                        ? 'border-gray-700 bg-gray-800'
                        : 'border-gray-200 bg-white'
                  )}
                >
                  <View className="flex-row items-center mb-2">
                    <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center mr-3">
                      <UserCog size={20} color="#8B5CF6" />
                    </View>
                    <View>
                      <Text className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        Admin
                      </Text>
                      <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {adminCount}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedRole('student')}
                  className={cn(
                    'p-4 rounded-2xl border-2 min-w-[120px]',
                    selectedRole === 'student'
                      ? 'border-teal-500 bg-teal-500/10'
                      : isDark
                        ? 'border-gray-700 bg-gray-800'
                        : 'border-gray-200 bg-white'
                  )}
                >
                  <View className="flex-row items-center mb-2">
                    <View className="w-10 h-10 rounded-full bg-teal-500/20 items-center justify-center mr-3">
                      <User size={20} color="#0D9488" />
                    </View>
                    <View>
                      <Text className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        Student
                      </Text>
                      <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {studentCount}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedRole('guardian')}
                  className={cn(
                    'p-4 rounded-2xl border-2 min-w-[120px]',
                    selectedRole === 'guardian'
                      ? 'border-teal-500 bg-teal-500/10'
                      : isDark
                        ? 'border-gray-700 bg-gray-800'
                        : 'border-gray-200 bg-white'
                  )}
                >
                  <View className="flex-row items-center mb-2">
                    <View className="w-10 h-10 rounded-full bg-pink-500/20 items-center justify-center mr-3">
                      <Heart size={20} color="#EC4899" />
                    </View>
                    <View>
                      <Text className={cn('font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        Guardian
                      </Text>
                      <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {guardianCount}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>

          {/* Permissions List */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <Text className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {selectedRole === 'instructor' ? 'Instructor' : selectedRole === 'admin' ? 'Admin' : selectedRole === 'guardian' ? 'Guardian' : 'Student'} Permissions
            </Text>
            <View
              className={cn('rounded-2xl overflow-hidden', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              {PERMISSIONS.filter((permission) =>
                selectedRole === 'student'
                  ? permission.id === 'view_members' || permission.id === 'view_videos'
                  : true
              ).map((permission, index, filtered) => {
                const key = `${selectedRole}_${permission.id}`;
                const isEnabled = permissions[key];

                return (
                  <View
                    key={permission.id}
                    className={cn(
                      'flex-row items-center px-4 py-4',
                      index < filtered.length - 1 && (isDark ? 'border-b border-gray-700' : 'border-b border-gray-100')
                    )}
                  >
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-3">
                      {permission.icon}
                    </View>
                    <View className="flex-1">
                      <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {permission.name}
                      </Text>
                      <Text className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        {permission.description}
                      </Text>
                    </View>
                    <Switch
                      value={isEnabled}
                      onValueChange={() => togglePermission(permission.id)}
                      trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: '#0D9488' }}
                      thumbColor="white"
                    />
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* Info */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mt-6">
            <View className={cn('rounded-xl p-4', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
              <Text className={cn('text-sm text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Changes to permissions will apply to all members with the selected role.
              </Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Admin Selection Modal */}
      <Modal visible={showAdminModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowAdminModal(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Assign Admins
            </Text>
            <Pressable onPress={() => setShowAdminModal(false)}>
              <Check size={24} color="#0D9488" />
            </Pressable>
          </View>

          <View className="px-5 py-4">
            <View className={cn('rounded-xl p-4 mb-4', isDark ? 'bg-purple-500/10' : 'bg-purple-50')}>
              <View className="flex-row items-center mb-2">
                <UserCog size={20} color="#8B5CF6" />
                <Text className={cn('font-semibold ml-2', isDark ? 'text-purple-400' : 'text-purple-700')}>
                  About Admin Role
                </Text>
              </View>
              <Text className={cn('text-sm', isDark ? 'text-purple-300/70' : 'text-purple-600')}>
                Admins can help manage the halau. They have access to member management, payments, events, and other administrative features. Select students below to grant them admin privileges.
              </Text>
            </View>

            <Text className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {adminCount} of {eligibleForAdmin.length} members are admins
            </Text>
          </View>

          <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
            {eligibleForAdmin.length > 0 ? (
              eligibleForAdmin.map((member) => (
                <MemberAdminItem
                  key={member.id}
                  memberId={member.id}
                  isDark={isDark}
                  onToggle={toggleAdminRole}
                />
              ))
            ) : (
              <View className="py-8 items-center">
                <Users size={40} color={isDark ? '#4B5563' : '#9CA3AF'} />
                <Text className={cn('mt-3 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  No members available
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
