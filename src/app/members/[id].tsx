import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert, Modal, Switch } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Shield,
  Edit3,
  Check,
  X,
  Crown,
  AlertTriangle,
  UserMinus,
  Lock,
  GraduationCap,
  Eye,
  EyeOff,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import type { MembershipPlan, UserRole, ClassLevel } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { useSubscription } from '@/lib/useSubscription';

export default function MemberDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Subscription check
  const { canAddAdmins, tier } = useSubscription();

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [membershipPlan, setMembershipPlan] = useState<MembershipPlan>('monthly');
  const [classLevel, setClassLevel] = useState<ClassLevel>('minor');
  const [showOwnerWarningModal, setShowOwnerWarningModal] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<UserRole | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  // Privacy settings
  const [showEmailToMembers, setShowEmailToMembers] = useState(false);
  const [showPhoneToMembers, setShowPhoneToMembers] = useState(false);
  // Member since (editable by teacher/admin)
  const [joinedAtInput, setJoinedAtInput] = useState('');
  const [joinedAtError, setJoinedAtError] = useState('');

  // Store selectors - get fresh data on each render
  const members = useAppStore((s) => s.members);
  const updateMember = useAppStore((s) => s.updateMember);
  const currentMemberId = useAppStore((s) => s.currentMember?.id);
  const isKumu = useAppStore((s) => s.isKumu);
  const isHalauOwner = useAppStore((s) => s.isHalauOwner);
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  const removeMember = useAppStore((s) => s.removeMember);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  const currentMemberRole = useAppStore((s) => s.currentMember?.role);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Find member from members array
  const member = members.find((m) => m.id === id);
  const isTeacher = isKumu();
  const isOwnProfile = currentMemberId === id;
  const canEdit = isTeacher || isOwnProfile;
  const isMemberOwner = isHalauOwner(id); // Check if this member is the owner
  const isCurrentUserOwner = isHalauOwner(); // Check if current user is the owner
  const isAdmin = currentMemberRole === 'admin';
  const canEditClassLevel = (isTeacher || isAdmin || isCurrentUserOwner) && (member?.role === 'student' || member?.role === 'admin' || member?.isKeiki);

  // Get available class levels for this halau
  const availableClassLevels = currentHalauId ? getClassLevelsForHalau(currentHalauId) : [];

  // Initialize form with member data
  useEffect(() => {
    if (member) {
      setFirstName(member.firstName);
      setLastName(member.lastName);
      setEmail(member.email);
      setPhone(member.phone || '');
      setRole(member.role);
      setMembershipPlan(member.membershipPlan);
      setClassLevel(member.classLevel || 'minor');
      setShowEmailToMembers(member.showEmailToMembers ?? false);
      setShowPhoneToMembers(member.showPhoneToMembers ?? false);
      // Format joinedAt as mm/dd/yyyy for the editable input
      try {
        const d = parseISO(member.joinedAt);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        setJoinedAtInput(`${mm}/${dd}/${yyyy}`);
      } catch {
        setJoinedAtInput('');
      }
      setJoinedAtError('');
    }
  }, [member?.id]);

  const handleSave = () => {
    if (!id || !firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Validate teacher-edited joinedAt date
    if (isTeacher && joinedAtInput) {
      const parts = joinedAtInput.split('/');
      if (parts.length !== 3 || joinedAtInput.replace(/\D/g, '').length !== 8) {
        setJoinedAtError('Enter a valid date (mm/dd/yyyy)');
        return;
      }
      const [m, d, y] = parts.map(Number);
      const testDate = new Date(y, m - 1, d);
      if (isNaN(testDate.getTime()) || testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
        setJoinedAtError('Enter a valid date (mm/dd/yyyy)');
        return;
      }
    }

    const updates: Partial<typeof member> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
    };

    // Only Kumu can change role, membership plan, and joined date
    if (isTeacher) {
      updates.role = role;
      updates.membershipPlan = membershipPlan;
      // Parse and save the edited join date
      if (joinedAtInput) {
        const [m, d, y] = joinedAtInput.split('/').map(Number);
        updates.joinedAt = new Date(y, m - 1, d).toISOString();
      }
    }

    // Owner, admin, or teacher can change class level for keiki
    if (canEditClassLevel) {
      updates.classLevel = classLevel;
    }

    // Privacy settings - only update for own profile
    if (isOwnProfile) {
      updates.showEmailToMembers = showEmailToMembers;
      updates.showPhoneToMembers = showPhoneToMembers;
    }

    updateMember(id, updates);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditing(false);
    Alert.alert('Success', 'Member information updated successfully');
  };

  // Handle role change with owner protection
  const handleRoleChange = (newRole: UserRole) => {
    // If trying to assign admin role without Enterprise tier
    if (newRole === 'admin' && !canAddAdmins) {
      Alert.alert(
        'Enterprise Feature',
        'Admin roles are only available with the Enterprise plan. Upgrade to assign admin permissions.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }

    // If this member is the owner and they're trying to change their own role
    if (isMemberOwner && isOwnProfile && newRole !== 'teacher' && newRole !== 'admin') {
      // Show warning modal
      setPendingRoleChange(newRole);
      setShowOwnerWarningModal(true);
      return;
    }

    // If someone is trying to change the owner's role (not the owner themselves)
    if (isMemberOwner && !isOwnProfile) {
      Alert.alert(
        'Cannot Change Owner Role',
        'Only the owner can change their own role. The owner must relinquish their permissions themselves.',
        [{ text: 'OK' }]
      );
      return;
    }

    setRole(newRole);
  };

  // Confirm owner relinquishing their role
  const handleConfirmOwnerRoleChange = () => {
    if (pendingRoleChange) {
      setRole(pendingRoleChange);
      setShowOwnerWarningModal(false);
      setPendingRoleChange(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  // Cancel owner role change
  const handleCancelOwnerRoleChange = () => {
    setShowOwnerWarningModal(false);
    setPendingRoleChange(null);
  };

  // Handle remove member
  const handleConfirmRemove = () => {
    if (id) {
      removeMember(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRemoveModal(false);
      router.back();
    }
  };

  // Check if can remove this member (teachers can remove students, not themselves)
  const canRemoveMember = isTeacher && member?.role === 'student' && !isOwnProfile;

  const handleCancel = () => {
    if (member) {
      setFirstName(member.firstName);
      setLastName(member.lastName);
      setEmail(member.email);
      setPhone(member.phone || '');
      setRole(member.role);
      setMembershipPlan(member.membershipPlan);
      setClassLevel(member.classLevel || 'minor');
      setShowEmailToMembers(member.showEmailToMembers ?? false);
      setShowPhoneToMembers(member.showPhoneToMembers ?? false);
      try {
        const d = parseISO(member.joinedAt);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        setJoinedAtInput(`${mm}/${dd}/${yyyy}`);
      } catch {
        setJoinedAtInput('');
      }
      setJoinedAtError('');
    }
    setIsEditing(false);
  };

  // Detect if any changes have been made relative to saved member data
  const originalJoinedAt = (() => {
    if (!member) return '';
    try {
      const d = parseISO(member.joinedAt);
      return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return ''; }
  })();

  const hasChanges = member
    ? firstName !== member.firstName ||
      lastName !== member.lastName ||
      email !== member.email ||
      phone !== (member.phone || '') ||
      role !== member.role ||
      membershipPlan !== member.membershipPlan ||
      classLevel !== (member.classLevel || 'minor') ||
      showEmailToMembers !== (member.showEmailToMembers ?? false) ||
      showPhoneToMembers !== (member.showPhoneToMembers ?? false) ||
      joinedAtInput !== originalJoinedAt
    : false;

  const startEditing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditing(true);
  };

  if (!member) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Member',
            headerStyle: { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
            headerTintColor: isDark ? '#FFFFFF' : '#111827',
            headerShadowVisible: false,
          }}
        />
        <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
          <Text className={cn('text-lg', isDark ? 'text-white' : 'text-gray-900')}>
            Member not found
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isOwnProfile ? 'My Profile' : 'Member Details',
          headerStyle: { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
          headerRight: () =>
            canEdit && !isEditing ? (
              <Pressable onPress={startEditing} className="pr-2">
                <Edit3 size={22} color={theme.primary} />
              </Pressable>
            ) : null,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
          <KeyboardAwareScrollView
            contentContainerStyle={{ paddingBottom: isEditing ? 200 : 100 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={16}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Header */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              className={cn('items-center py-8', isDark ? 'bg-gray-900' : 'bg-white')}
            >
              <View
                className={cn(
                  'w-24 h-24 rounded-full items-center justify-center mb-4',
                  member.role === 'teacher' ? 'bg-amber-500' : ''
                )}
                style={member.role !== 'teacher' ? { backgroundColor: theme.primary } : undefined}
              >
                <Text className="text-white text-3xl font-bold">
                  {(isEditing ? firstName : member.firstName)[0]?.toUpperCase() || '?'}
                  {(isEditing ? lastName : member.lastName)[0]?.toUpperCase() || ''}
                </Text>
              </View>
              <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {isEditing ? `${firstName} ${lastName}` : `${member.firstName} ${member.lastName}`}
              </Text>
              <View
                className={cn(
                  'mt-2 px-3 py-1 rounded-full',
                  (isEditing ? role : member.role) === 'teacher' ? 'bg-amber-500/10' : 'bg-teal-500/10'
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-medium capitalize',
                    (isEditing ? role : member.role) === 'teacher' ? 'text-amber-600' : 'text-teal-600'
                  )}
                >
                  {isEditing ? role : member.role}
                </Text>
              </View>
              {isOwnProfile && !isEditing && (
                <Text className={cn('mt-2 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  This is your profile
                </Text>
              )}
              {isEditing && (
                <View className="bg-teal-500/20 px-3 py-1 rounded-full mt-2">
                  <Text className="text-teal-600 text-sm font-medium">Editing Mode</Text>
                </View>
              )}
            </Animated.View>

            {/* Contact Information */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)} className="px-5 mt-6">
              <Text className={cn('text-lg font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                Contact Information
              </Text>
              <View className={cn('rounded-2xl px-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                {/* First Name */}
                <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <User size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        First Name
                      </Text>
                      {isEditing ? (
                        <TextInput
                          className={cn(
                            'text-base py-2 px-3 rounded-lg',
                            isDark ? 'text-white bg-gray-800' : 'text-gray-900 bg-gray-100'
                          )}
                          value={firstName}
                          onChangeText={setFirstName}
                          autoCapitalize="words"
                          placeholder="Enter first name"
                          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                          cursorColor={isDark ? '#FFFFFF' : '#000000'}
                          selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                        />
                      ) : (
                        <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.firstName || '-'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Last Name */}
                <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <User size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Last Name
                      </Text>
                      {isEditing ? (
                        <TextInput
                          className={cn(
                            'text-base py-2 px-3 rounded-lg',
                            isDark ? 'text-white bg-gray-800' : 'text-gray-900 bg-gray-100'
                          )}
                          value={lastName}
                          onChangeText={setLastName}
                          autoCapitalize="words"
                          placeholder="Enter last name"
                          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                          cursorColor={isDark ? '#FFFFFF' : '#000000'}
                          selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                        />
                      ) : (
                        <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.lastName || '-'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Email - visible to teachers/admins, own profile, or if member allows */}
                {(isTeacher || isOwnProfile || member.showEmailToMembers) ? (
                <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <Mail size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Email
                      </Text>
                      {isEditing ? (
                        <TextInput
                          className={cn(
                            'text-base py-2 px-3 rounded-lg',
                            isDark ? 'text-white bg-gray-800' : 'text-gray-900 bg-gray-100'
                          )}
                          value={email}
                          onChangeText={setEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          placeholder="Enter email"
                          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                          cursorColor={isDark ? '#FFFFFF' : '#000000'}
                          selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                        />
                      ) : (
                        <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.email || '-'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                ) : (
                <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-gray-500/10 items-center justify-center mr-4">
                      <EyeOff size={20} color="#6B7280" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Email
                      </Text>
                      <Text className={cn('text-base italic', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Hidden by member
                      </Text>
                    </View>
                  </View>
                </View>
                )}

                {/* Phone - visible to teachers/admins, own profile, or if member allows */}
                {(isTeacher || isOwnProfile || member.showPhoneToMembers) ? (
                <View className={cn('py-4', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <Phone size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Phone
                      </Text>
                      {isEditing ? (
                        <TextInput
                          className={cn(
                            'text-base py-2 px-3 rounded-lg',
                            isDark ? 'text-white bg-gray-800' : 'text-gray-900 bg-gray-100'
                          )}
                          value={phone}
                          onChangeText={(text) => {
                            const digits = text.replace(/\D/g, '').slice(0, 10);
                            if (digits.length === 0) { setPhone(''); return; }
                            if (digits.length <= 3) { setPhone(`(${digits}`); return; }
                            if (digits.length <= 6) { setPhone(`(${digits.slice(0, 3)})${digits.slice(3)}`); return; }
                            setPhone(`(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`);
                          }}
                          keyboardType="phone-pad"
                          placeholder="(123)456-7890"
                          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        />
                      ) : (
                        <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.phone || 'Not provided'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                ) : (
                <View className={cn('py-4', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-gray-500/10 items-center justify-center mr-4">
                      <EyeOff size={20} color="#6B7280" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Phone
                      </Text>
                      <Text className={cn('text-base italic', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Hidden by member
                      </Text>
                    </View>
                  </View>
                </View>
                )}
              </View>
            </Animated.View>

            {/* Privacy Settings - Only visible when editing own profile */}
            {isOwnProfile && isEditing && (
              <Animated.View entering={FadeInDown.delay(250).duration(400)} className="px-5 mt-6">
                <Text className={cn('text-lg font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                  Privacy Settings
                </Text>
                <View className={cn('rounded-2xl px-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                  {/* Show Email to Members */}
                  <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center mr-4">
                        {showEmailToMembers ? (
                          <Eye size={20} color="#3B82F6" />
                        ) : (
                          <EyeOff size={20} color="#6B7280" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className={cn('text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                          Show Email to Members
                        </Text>
                        <Text className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          Allow other members to see your email
                        </Text>
                      </View>
                      <Switch
                        value={showEmailToMembers}
                        onValueChange={setShowEmailToMembers}
                        trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: '#3B82F6' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>

                  {/* Show Phone to Members */}
                  <View className={cn('py-4', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center mr-4">
                        {showPhoneToMembers ? (
                          <Eye size={20} color="#3B82F6" />
                        ) : (
                          <EyeOff size={20} color="#6B7280" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className={cn('text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                          Show Phone to Members
                        </Text>
                        <Text className={cn('text-xs mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          Allow other members to see your phone number
                        </Text>
                      </View>
                      <Switch
                        value={showPhoneToMembers}
                        onValueChange={setShowPhoneToMembers}
                        trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: '#3B82F6' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  </View>
                </View>
                <Text className={cn('text-xs mt-2 px-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  Teachers and admins can always see your contact information.
                </Text>
              </Animated.View>
            )}

            {/* Membership Information - Sensitive fields only visible to teachers/admins or own profile */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="px-5 mt-6">
              <Text className={cn('text-lg font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
                Membership
              </Text>
              <View className={cn('rounded-2xl px-4', isDark ? 'bg-gray-900' : 'bg-white')}>
                {/* Role - Only visible to teachers/admins or own profile */}
                {(isTeacher || isOwnProfile) && (
                <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <Shield size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center">
                        <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          Role
                        </Text>
                        {isMemberOwner && (
                          <View className="flex-row items-center ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 mb-1">
                            <Crown size={10} color="#F59E0B" />
                            <Text className="text-xs font-medium text-amber-600 ml-1">Owner</Text>
                          </View>
                        )}
                      </View>
                      {isEditing && isTeacher ? (
                        <View className="flex-row gap-2 mt-2 flex-wrap">
                          {(['student', 'teacher', 'admin'] as UserRole[]).map((r) => {
                            const isAdminLocked = r === 'admin' && !canAddAdmins;
                            return (
                              <Pressable
                                key={r}
                                onPress={() => handleRoleChange(r)}
                                style={{ minHeight: 44, minWidth: 80 }}
                                className={cn(
                                  'px-5 py-3 rounded-xl flex-row items-center justify-center',
                                  role === r ? 'bg-teal-500' : isDark ? 'bg-gray-800' : 'bg-gray-100',
                                  isAdminLocked && role !== r && 'opacity-60'
                                )}
                              >
                                {isAdminLocked && role !== r && (
                                  <Lock size={14} color={isDark ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 5 }} />
                                )}
                                <Text
                                  className={cn(
                                    'font-semibold capitalize text-sm',
                                    role === r ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                                  )}
                                >
                                  {r}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : (
                        <Text className={cn('text-base capitalize', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.role}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                )}

                {/* Membership Plan - Only visible to teachers/admins or own profile */}
                {(isTeacher || isOwnProfile) && (
                <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <CreditCard size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Membership Plan
                      </Text>
                      {isEditing && isTeacher ? (
                        <View className="flex-row gap-2 mt-2">
                          {(['monthly', 'annual'] as MembershipPlan[]).map((plan) => (
                            <Pressable
                              key={plan}
                              onPress={() => setMembershipPlan(plan)}
                              style={{ minHeight: 44, minWidth: 88 }}
                              className={cn(
                                'px-5 py-3 rounded-xl items-center justify-center',
                                membershipPlan === plan ? 'bg-teal-500' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                              )}
                            >
                              <Text
                                className={cn(
                                  'font-semibold capitalize text-sm',
                                  membershipPlan === plan ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                                )}
                              >
                                {plan}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text className={cn('text-base capitalize', isDark ? 'text-white' : 'text-gray-900')}>
                          {member.membershipPlan}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                )}

                {/* Class Level - For students/admins/keiki, editable by owner/admin/teacher */}
                {(member.isKeiki || member.role === 'student' || member.role === 'admin') && (isTeacher || isAdmin || isCurrentUserOwner || isOwnProfile) && (
                  <View className={cn('py-4 border-b', isDark ? 'border-gray-800' : 'border-gray-100')}>
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-purple-500/10 items-center justify-center mr-4">
                        <GraduationCap size={20} color="#8B5CF6" />
                      </View>
                      <View className="flex-1">
                        <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          Class Level
                        </Text>
                        {isEditing && canEditClassLevel ? (
                          <View className="flex-row gap-2 mt-2 flex-wrap">
                            {availableClassLevels.map((level) => (
                              <Pressable
                                key={level.id}
                                onPress={() => setClassLevel(level.value)}
                                style={{ minHeight: 44 }}
                                className={cn(
                                  'px-5 py-3 rounded-xl items-center justify-center',
                                  classLevel === level.value ? 'bg-purple-500' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                                )}
                              >
                                <Text
                                  className={cn(
                                    'font-semibold text-sm',
                                    classLevel === level.value ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                                  )}
                                >
                                  {level.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {availableClassLevels.find((l) => l.value === member.classLevel)?.label || member.classLevel || 'Not set'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {/* Member Since */}
                <View className={cn('py-4', isDark ? 'border-gray-800' : 'border-gray-100')}>
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
                      <Calendar size={20} color="#0D9488" />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('text-xs uppercase tracking-wider mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Member Since
                      </Text>
                      {isEditing && isTeacher ? (
                        <>
                          <TextInput
                            className={cn(
                              'text-base py-2 px-3 rounded-lg',
                              isDark ? 'text-white bg-gray-800' : 'text-gray-900 bg-gray-100',
                              joinedAtError ? 'border border-red-500' : ''
                            )}
                            value={joinedAtInput}
                            onChangeText={(text) => {
                              const digits = text.replace(/\D/g, '');
                              let formatted = digits;
                              if (digits.length > 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
                              if (digits.length > 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
                              setJoinedAtInput(formatted);
                              setJoinedAtError('');
                            }}
                            placeholder="mm/dd/yyyy"
                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                            keyboardType="number-pad"
                            maxLength={10}
                            cursorColor={isDark ? '#FFFFFF' : '#000000'}
                            selectionColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                          />
                          {joinedAtError ? (
                            <Text className="text-red-500 text-xs mt-1">{joinedAtError}</Text>
                          ) : null}
                        </>
                      ) : (
                        <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                          {format(parseISO(member.joinedAt), 'MMMM d, yyyy')}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Edit Button for non-editing state */}
            {!isEditing && canEdit && (
              <Animated.View entering={FadeInDown.delay(400).duration(400)} className="px-5 mt-6">
                <Pressable
                  onPress={startEditing}
                  className="bg-teal-500 rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.5 : 0.18,
                    shadowRadius: 12,
                    elevation: 10,
                  }}
                >
                  <Edit3 size={20} color="white" />
                  <Text className="text-white font-semibold text-base ml-2">
                    Edit {isOwnProfile ? 'My' : 'Member'} Information
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Remove Student Button - Only for teachers viewing students */}
            {!isEditing && canRemoveMember && (
              <Animated.View entering={FadeInDown.delay(450).duration(400)} className="px-5 mt-4">
                <Pressable
                  onPress={() => setShowRemoveModal(true)}
                  className={cn(
                    'rounded-2xl py-4 flex-row items-center justify-center active:opacity-80 border',
                    isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-200 bg-red-50'
                  )}
                  style={{
                    shadowColor: '#EF4444',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <UserMinus size={20} color="#EF4444" />
                  <Text className="text-red-500 font-semibold text-base ml-2">
                    Remove Student
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </KeyboardAwareScrollView>

          {/* Fixed Bottom Buttons for Editing Mode */}
          {isEditing && (
            <View
              className={cn(
                'absolute bottom-0 left-0 right-0 px-5 py-4 border-t',
                isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
              )}
              style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            >
              <View className="flex-row gap-3">
                <Pressable
                  onPress={handleCancel}
                  className={cn(
                    'flex-1 py-4 rounded-2xl flex-row items-center justify-center active:opacity-80',
                    isDark ? 'bg-gray-800' : 'bg-gray-100'
                  )}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.4 : 0.1,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  <X size={20} color={isDark ? '#FFFFFF' : '#374151'} />
                  <Text className={cn('font-semibold ml-2', isDark ? 'text-white' : 'text-gray-700')}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={hasChanges ? handleSave : undefined}
                  className={cn(
                    'flex-1 py-4 rounded-2xl flex-row items-center justify-center',
                    hasChanges ? 'bg-teal-500 active:opacity-80' : 'bg-teal-500/30'
                  )}
                  style={hasChanges ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: isDark ? 0.5 : 0.18,
                    shadowRadius: 12,
                    elevation: 10,
                  } : undefined}
                >
                  <Check size={20} color={hasChanges ? 'white' : 'rgba(255,255,255,0.4)'} />
                  <Text className={cn('font-semibold ml-2', hasChanges ? 'text-white' : 'text-white/40')}>
                    Save Changes
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

      {/* Owner Role Change Warning Modal */}
      <Modal visible={showOwnerWarningModal} animationType="fade" transparent>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View
            className={cn('w-full rounded-3xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
          >
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-amber-500/20 items-center justify-center mb-4">
                <AlertTriangle size={32} color="#F59E0B" />
              </View>
              <Text className={cn('text-xl font-bold text-center', isDark ? 'text-white' : 'text-gray-900')}>
                Relinquish Owner Permissions?
              </Text>
            </View>

            <Text className={cn('text-center mb-6', isDark ? 'text-gray-400' : 'text-gray-600')}>
              You are about to change your role from a leadership position. As the owner, you have full administrative rights to this school.
              {'\n\n'}
              By changing your role to "{pendingRoleChange}", you will be voluntarily giving up your owner permissions. This action can only be reversed by another admin or teacher.
              {'\n\n'}
              Are you sure you want to proceed?
            </Text>

            <View className="gap-3">
              <Pressable
                onPress={handleConfirmOwnerRoleChange}
                className="bg-amber-500 py-4 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-base">
                  Yes, Relinquish My Permissions
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCancelOwnerRoleChange}
                className={cn(
                  'py-4 rounded-xl items-center',
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                )}
              >
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-700')}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
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
            {member && (
              <View className={cn('rounded-2xl p-4 mb-5', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                <View className="flex-row items-center">
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Text className="text-white text-lg font-bold">
                      {member.firstName[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      {member.firstName} {member.lastName}
                    </Text>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {member.email}
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
                onPress={() => setShowRemoveModal(false)}
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
    </>
  );
}
