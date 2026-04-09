import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, Modal, Image, Linking, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView, type KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Users,
  FileText,
  Moon,
  ChevronRight,
  LogOut,
  Building2,
  Share2,
  Shield,
  HelpCircle,
  Palette,
  Copy,
  Check,
  X,
  Camera,
  Crown,
  Heart,
  Wallet,
  ScrollText,
  GraduationCap,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { useDeepMemo } from '@/lib/useDeepMemo';
import { useSubscription } from '@/lib/useSubscription';
import { TEACHER_PRICE_FALLBACK, ADMIN_PRICE_FALLBACK } from '@/lib/subscription';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function MoreScreenInner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  // Ref to track the copied-reset timer so it can be cleared on unmount (prevents
  // "state update on unmounted component" if user navigates away within 2 s)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // Class levels modal state
  const [showClassLevelsModal, setShowClassLevelsModal] = useState(false);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [newLevelLabel, setNewLevelLabel] = useState('');
  const classLevelsScrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const levelYPositions = useRef<Record<string, number>>({});  const [newLevelDescription, setNewLevelDescription] = useState('');
  const [showAddLevel, setShowAddLevel] = useState(false);

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useDeepMemo(useAppStore((s) => s.currentMember));
  const currentUser = useDeepMemo(useAppStore((s) => s.currentUser));
  const getHalau = useAppStore((s) => s.getHalau);
  const signOut = useAppStore((s) => s.signOut);
  const isKumu = useAppStore((s) => s.isKumu);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  const updateMember = useAppStore((s) => s.updateMember);
  const addCustomClassLevel = useAppStore((s) => s.addCustomClassLevel);
  const updateCustomClassLevel = useAppStore((s) => s.updateCustomClassLevel);
  const deleteCustomClassLevel = useAppStore((s) => s.deleteCustomClassLevel);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  const updateHalauName = useAppStore((s) => s.updateHalauName);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  // School name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;
  const isTeacher = isKumu();
  const classLevels = currentHalauId ? getClassLevelsForHalau(currentHalauId) : [];

  // Get title settings
  const getTitleSettings = useAppStore((s) => s.getTitleSettings);
  const titleSettings = currentHalauId ? getTitleSettings(currentHalauId) : { teacherTitle: 'Teacher', studentTitle: 'Student', adminTitle: 'Admin' };

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  const { status: subStatus, trialDaysLeft, isTeacherRole } = useSubscription();
  const priceFallback = isTeacherRole ? TEACHER_PRICE_FALLBACK : ADMIN_PRICE_FALLBACK;

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            signOut();
            router.replace('/intro');
          },
        },
      ]
    );
  };

  const copyInviteCode = async () => {
    if (halau?.inviteCode) {
      await Clipboard.setStringAsync(halau.inviteCode);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      // Clear any existing timer before setting a new one
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  // Ref guard to prevent double-tap opening two ImagePicker dialogs simultaneously
  const isPickingPhotoRef = useRef(false);

  const handlePickProfilePhoto = async () => {
    if (isPickingPhotoRef.current) return;
    isPickingPhotoRef.current = true;
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to change your profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && currentMember) {
        updateMember(currentMember.id, { profilePhoto: result.assets[0].uri });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      isPickingPhotoRef.current = false;
    }
  };

  // Class level handlers
  const handleStartEditLevel = (levelId: string, label: string, description?: string) => {
    setEditingLevelId(levelId);
    setEditingLabel(label);
    setEditingDescription(description || '');
    // Scroll to the editing card so the keyboard doesn't cover it
    setTimeout(() => {
      const y = levelYPositions.current[levelId];
      if (y !== undefined) {
        classLevelsScrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
      }
    }, 100);
  };

  const handleSaveEditLevel = () => {
    if (!currentHalauId || !editingLevelId || !editingLabel.trim()) return;
    updateCustomClassLevel(currentHalauId, editingLevelId, {
      label: editingLabel.trim(),
      description: editingDescription.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditingLevelId(null);
    setEditingLabel('');
    setEditingDescription('');
  };

  const handleCancelEditLevel = () => {
    setEditingLevelId(null);
    setEditingLabel('');
    setEditingDescription('');
  };

  const handleAddLevel = () => {
    if (!currentHalauId || !newLevelLabel.trim()) return;
    addCustomClassLevel(currentHalauId, newLevelLabel.trim(), newLevelDescription.trim() || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewLevelLabel('');
    setNewLevelDescription('');
    setShowAddLevel(false);
  };

  const handleDeleteLevel = (levelId: string, label: string) => {
    // Default levels cannot be deleted, only renamed
    const defaultIds = ['minor', 'beginner', 'intermediate', 'advanced'];
    if (defaultIds.includes(levelId)) {
      Alert.alert('Default Level', 'Default class levels cannot be deleted, but you can rename them.');
      return;
    }
    Alert.alert(
      'Delete Class Level',
      `Are you sure you want to delete "${label}"? Members assigned to this level will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (currentHalauId) {
              deleteCustomClassLevel(currentHalauId, levelId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  };

  const MenuItem = ({
    icon,
    title,
    subtitle,
    onPress,
    showArrow = true,
    rightElement,
    danger,
    delay = 0,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    rightElement?: React.ReactNode;
    danger?: boolean;
    delay?: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Pressable
        onPress={onPress}
        className={cn(
          'flex-row items-center px-4 py-3.5 active:opacity-70',
          isDark ? 'bg-gray-900/80' : 'bg-white'
        )}
      >
        <View
          className="w-9 h-9 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: danger ? '#EF444415' : `${theme.primary}15` }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text
            className={cn(
              'font-medium',
              danger ? 'text-red-500' : isDark ? 'text-white' : 'text-gray-900'
            )}
          >
            {title}
          </Text>
          {subtitle && (
            <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightElement}
        {showArrow && !rightElement && (
          <ChevronRight size={20} color={isDark ? '#6B6B6B' : '#9CA3AF'} />
        )}
      </Pressable>
    </Animated.View>
  );

  const SectionHeader = ({ title, delay = 0 }: { title: string; delay?: number }) => (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Text
        className={cn(
          'text-xs font-semibold uppercase tracking-wider px-4 py-2',
          isDark ? 'text-gray-500' : 'text-gray-400'
        )}
      >
        {title}
      </Text>
    </Animated.View>
  );

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-[#FAFAFA]')}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View
          className={cn('px-5 pb-6', isDark ? 'bg-black' : 'bg-white')}
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className={cn('text-2xl font-bold mb-6', isDark ? 'text-white' : 'text-gray-900')}>
            More
          </Text>

          {/* Profile Card */}
          <View
            className={cn(
              'flex-row items-center p-4 rounded-2xl',
              isDark ? 'bg-gray-900/80' : 'bg-gray-100'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: isDark ? 0.4 : 0.1,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <Pressable onPress={handlePickProfilePhoto} className="relative">
              {currentMember?.profilePhoto ? (
                <Image
                  source={{ uri: currentMember.profilePhoto }}
                  className="w-14 h-14 rounded-full"
                />
              ) : (
                <View
                  className="w-14 h-14 rounded-full items-center justify-center"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Text className="text-white text-xl font-bold">
                    {((currentMember?.firstName || currentUser?.email || '?')[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full items-center justify-center border-2 border-white"
                style={{ backgroundColor: theme.primary }}
              >
                <Camera size={12} color="white" />
              </View>
            </Pressable>
            <Pressable
              onPress={() => currentMember && router.push(`/members/${currentMember.id}` as never)}
              className="flex-1 ml-4 flex-row items-center active:opacity-80"
            >
              <View className="flex-1">
                <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                  {currentMember?.firstName
                    ? `${currentMember.firstName} ${currentMember.lastName}`
                    : currentUser?.email}
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {isTeacher ? titleSettings.teacherTitle : titleSettings.studentTitle} • Tap to edit profile
                </Text>
              </View>
              <ChevronRight size={20} color={isDark ? '#6B6B6B' : '#9CA3AF'} />
            </Pressable>
          </View>
        </View>

        {/* School Section - Only show for Teacher */}
        {halau && isTeacher && (
          <>
            <SectionHeader title="School" delay={50} />
            <View className={cn('mx-4 rounded-2xl overflow-hidden mb-6', isDark ? 'bg-gray-900/80' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.5 : 0.12,
                shadowRadius: 14,
                elevation: 10,
              }}
            >
              {/* School name - editable by owner */}
              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <View
                  className={cn(
                    'flex-row items-center px-4 py-3.5',
                    isDark ? 'bg-gray-900/80' : 'bg-white'
                  )}
                >
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: `${theme.primary}15` }}
                  >
                    <Building2 size={20} color={theme.primary} />
                  </View>
                  <View className="flex-1">
                    {isEditingName ? (
                      <View className="flex-row items-center">
                        <TextInput
                          value={editingName}
                          onChangeText={setEditingName}
                          autoFocus
                          returnKeyType="done"
                          onSubmitEditing={async () => {
                            if (!editingName.trim() || !currentHalauId) return;
                            setIsSavingName(true);
                            const result = await updateHalauName(currentHalauId, editingName.trim());
                            setIsSavingName(false);
                            if (result.success) {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setIsEditingName(false);
                            } else {
                              Alert.alert('Error', result.error ?? 'Could not update school name.');
                            }
                          }}
                          className={cn(
                            'flex-1 text-sm font-medium rounded-lg px-2 py-1 mr-2',
                            isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                          )}
                          placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                        />
                        <Pressable
                          onPress={async () => {
                            if (!editingName.trim() || !currentHalauId) return;
                            setIsSavingName(true);
                            const result = await updateHalauName(currentHalauId, editingName.trim());
                            setIsSavingName(false);
                            if (result.success) {
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                              setIsEditingName(false);
                            } else {
                              Alert.alert('Error', result.error ?? 'Could not update school name.');
                            }
                          }}
                          disabled={isSavingName || !editingName.trim()}
                          className="w-7 h-7 rounded-full items-center justify-center mr-1"
                          style={{ backgroundColor: theme.primary }}
                        >
                          <Check size={14} color="#fff" />
                        </Pressable>
                        <Pressable
                          onPress={() => setIsEditingName(false)}
                          className={cn('w-7 h-7 rounded-full items-center justify-center', isDark ? 'bg-gray-700' : 'bg-gray-200')}
                        >
                          <X size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Text className={cn('font-medium flex-1', isDark ? 'text-white' : 'text-gray-900')}>
                          {halau.name}
                        </Text>
                        <Pressable
                          onPress={() => { setEditingName(halau.name); setIsEditingName(true); }}
                          className="w-7 h-7 rounded-full items-center justify-center active:opacity-60"
                          style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}
                        >
                          <Edit3 size={13} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                      </View>
                    )}
                    <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      Code: {halau.inviteCode}
                    </Text>
                  </View>
                </View>
              </Animated.View>
              <MenuItem
                icon={<Share2 size={20} color={theme.primary} />}
                title="School Code"
                subtitle="Share your school invite code"
                onPress={() => setShowInviteModal(true)}
                delay={150}
              />
            </View>
          </>
        )}

        {/* School Section - Students Only */}
        {!isTeacher && (
          <>
            <SectionHeader title="School" delay={50} />
            <View className={cn('mx-4 rounded-2xl overflow-hidden mb-6', isDark ? 'bg-gray-900/80' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.5 : 0.12,
                shadowRadius: 14,
                elevation: 10,
              }}
            >
              <MenuItem
                icon={<Users size={20} color={theme.primary} />}
                title="Members"
                subtitle="View school members"
                onPress={() => router.push('/members' as never)}
                delay={100}
              />
              <MenuItem
                icon={<Wallet size={20} color={theme.primary} />}
                title="Payments & Dues"
                subtitle="View your dues and request reimbursements"
                onPress={() => router.push('/financials' as never)}
                delay={150}
              />
            </View>
          </>
        )}

        {/* Management Section (Kumu only) */}
        {isTeacher && (
          <>
            <SectionHeader title="Management" delay={250} />
            <View className={cn('mx-4 rounded-2xl overflow-hidden mb-6', isDark ? 'bg-gray-900/80' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.5 : 0.12,
                shadowRadius: 14,
                elevation: 10,
              }}
            >
              <MenuItem
                icon={<Users size={20} color={theme.primary} />}
                title="Members"
                subtitle="Manage your students"
                onPress={() => router.push('/members' as never)}
                delay={300}
              />
              <MenuItem
                icon={<Wallet size={20} color={theme.primary} />}
                title="Financials"
                subtitle="Dues, expenses & transactions"
                onPress={() => router.push('/financials' as never)}
                delay={350}
              />
              <MenuItem
                icon={<FileText size={20} color={theme.primary} />}
                title="Waivers"
                subtitle="Digital waiver management"
                onPress={() => router.push('/waivers' as never)}
                delay={400}
              />
              <MenuItem
                icon={<GraduationCap size={20} color={theme.primary} />}
                title="Customize Class Levels"
                subtitle="Rename and manage class levels"
                onPress={() => setShowClassLevelsModal(true)}
                delay={425}
              />
            </View>
          </>
        )}

        {/* Settings Section */}
        <SectionHeader title="Settings" delay={isTeacher ? 450 : 100} />
        <View className={cn('mx-4 rounded-2xl overflow-hidden mb-6', isDark ? 'bg-gray-900/80' : 'bg-white')}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.6 : 0.25,
            shadowRadius: 8,
            elevation: isDark ? 8 : 6,
          }}
        >
          <MenuItem
            icon={<Moon size={20} color={theme.primary} />}
            title="Dark Mode"
            showArrow={false}
            rightElement={
              <Switch
                value={isDarkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: '#D1D5DB', true: theme.primary }}
                thumbColor="white"
              />
            }
            delay={isTeacher ? 500 : 150}
          />
          {isTeacher && (
            <MenuItem
              icon={<Palette size={20} color={theme.primary} />}
              title="School Branding"
              subtitle="Customize colors and logo"
              onPress={() => router.push('/halau/branding' as never)}
              delay={550}
            />
          )}
          {isTeacher && (
            <MenuItem
              icon={<Shield size={20} color={theme.primary} />}
              title="Permissions"
              subtitle="Manage member access rights"
              onPress={() => router.push('/settings/permissions' as never)}
              delay={575}
            />
          )}
        </View>

        {/* Subscription Section - Teachers only */}
        {isTeacher && (
          <>
            <SectionHeader title="Subscription" delay={660} />
            <Animated.View
              entering={FadeInDown.delay(680).duration(400)}
              className="mx-4 mb-6 rounded-2xl overflow-hidden"
              style={{
                shadowColor: subStatus === 'active' ? '#10b981' : subStatus === 'trialing' ? '#f59e0b' : '#EF4444',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.2,
                shadowRadius: 14,
                elevation: 10,
              }}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (subStatus === 'active') {
                    // Apple requires a direct path to manage/cancel subscriptions
                    Linking.openURL('https://apps.apple.com/account/subscriptions');
                  } else {
                    router.push('/paywall' as never);
                  }
                }}
              >
                <LinearGradient
                  colors={
                    subStatus === 'active'
                      ? (isDark ? ['#064e3b', '#065f46'] : ['#ecfdf5', '#d1fae5'])
                      : subStatus === 'trialing'
                      ? (isDark ? ['#451a03', '#78350f'] : ['#fffbeb', '#fef3c7'])
                      : (isDark ? ['#1c1917', '#1c1917'] : ['#ffffff', '#fafafa'])
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: 16 }}
                >
                  <View className="flex-row items-center">
                    {/* Icon */}
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          subStatus === 'active'
                            ? 'rgba(16,185,129,0.2)'
                            : subStatus === 'trialing'
                            ? 'rgba(245,158,11,0.2)'
                            : 'rgba(107,114,128,0.15)',
                        marginRight: 14,
                      }}
                    >
                      {subStatus === 'active' ? (
                        <Crown size={22} color="#10b981" />
                      ) : subStatus === 'trialing' ? (
                        <Sparkles size={22} color="#f59e0b" />
                      ) : (
                        <AlertCircle size={22} color="#6b7280" />
                      )}
                    </View>

                    {/* Text */}
                    <View className="flex-1">
                      <Text
                        style={{
                          fontWeight: '700',
                          fontSize: 15,
                          color:
                            subStatus === 'active'
                              ? '#10b981'
                              : subStatus === 'trialing'
                              ? '#f59e0b'
                              : isDark ? '#ffffff' : '#111827',
                        }}
                      >
                        {subStatus === 'active'
                          ? 'School Owner — Active'
                          : subStatus === 'trialing'
                          ? 'Free Trial'
                          : 'No Active Subscription'}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          marginTop: 2,
                          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                        }}
                      >
                        {subStatus === 'active'
                          ? 'All features unlocked • Tap to manage'
                          : subStatus === 'trialing'
                          ? trialDaysLeft > 0
                            ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining • Tap to subscribe`
                            : 'Trial active • Tap to subscribe'
                          : `${priceFallback}/month • Tap to subscribe`}
                      </Text>
                    </View>

                    <ChevronRight
                      size={18}
                      color={
                        subStatus === 'active'
                          ? '#10b981'
                          : subStatus === 'trialing'
                          ? '#f59e0b'
                          : isDark ? '#6b7280' : '#9ca3af'
                      }
                    />
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </>
        )}

        {/* Support Section */}
        <SectionHeader title="Support" delay={isTeacher ? 700 : 300} />
        <View className={cn('mx-4 rounded-2xl overflow-hidden mb-6', isDark ? 'bg-gray-900/80' : 'bg-white')}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.6 : 0.25,
            shadowRadius: 8,
            elevation: isDark ? 8 : 6,
          }}
        >
          {/* Ko-Fi link: only shown to students/guardians (not_required role).
              Teachers and owners have IAP subscription flows — showing an external
              donation/payment link to them risks Apple App Store policy rejection. */}
          {subStatus === 'not_required' && (
            <MenuItem
              icon={<Heart size={20} color="#F43F5E" />}
              title="Support HalauHub"
              subtitle="Help keep the app free for everyone"
              onPress={() => Linking.openURL('https://ko-fi.com/kolohekinebitz')}
              delay={350}
            />
          )}
          <MenuItem
            icon={<HelpCircle size={20} color={theme.primary} />}
            title="Help Center"
            subtitle="Learn how to use the app"
            onPress={() => router.push('/help-center')}
            delay={isTeacher ? 800 : 400}
          />
          <MenuItem
            icon={<ScrollText size={20} color={theme.primary} />}
            title="Privacy Policy"
            subtitle="How we handle your data"
            onPress={() => router.push('/privacy-policy')}
            delay={isTeacher ? 850 : 450}
          />
          <MenuItem
            icon={<FileText size={20} color={theme.primary} />}
            title="Terms of Use (EULA)"
            subtitle="App usage terms and conditions"
            onPress={() => router.push('/terms-of-service')}
            delay={isTeacher ? 900 : 500}
          />
          <MenuItem
            icon={<Trash2 size={20} color="#EF4444" />}
            title="Delete Account"
            subtitle="Permanently remove your account and data"
            onPress={() => router.push('/delete-account')}
            delay={isTeacher ? 950 : 550}
          />
        </View>

        {/* Sign Out */}
        <View className={cn('mx-4 rounded-2xl overflow-hidden mb-6', isDark ? 'bg-gray-900/80' : 'bg-white')}
          style={{
            shadowColor: '#EF4444',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <MenuItem
            icon={<LogOut size={20} color="#EF4444" />}
            title="Sign Out"
            onPress={handleSignOut}
            showArrow={false}
            danger
            delay={isTeacher ? 1000 : 600}
          />
        </View>

        <Text className={cn('text-center text-xs mb-4', isDark ? 'text-gray-600' : 'text-gray-400')}>
          HalauHub v2.4.2
        </Text>
      </ScrollView>

      {/* Class Levels Modal */}
      <Modal visible={showClassLevelsModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-[#FAFAFA]')}>
          {/* Header */}
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800 bg-black' : 'border-gray-200 bg-white')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 14 }}
          >
            <Pressable
              onPress={() => {
                setShowClassLevelsModal(false);
                setEditingLevelId(null);
                setShowAddLevel(false);
                setNewLevelLabel('');
                setNewLevelDescription('');
              }}
              className="w-9 h-9 items-center justify-center rounded-full active:opacity-70"
              style={{ backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }}
            >
              <X size={20} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Class Levels
            </Text>
            <View className="w-9" />
          </View>

          <KeyboardAwareScrollView
            ref={classLevelsScrollRef}
            contentContainerStyle={{ paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={16}
          >
            {/* Subtitle */}
            <View className="px-5 pt-5 pb-3">
              <Text className={cn('text-sm leading-5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Rename default levels or add custom ones to match your school's structure. All changes apply across the app immediately.
              </Text>
            </View>

            {/* Existing levels */}
            <View className="px-5 mb-2">
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Current Levels
              </Text>
              {classLevels.map((level, index) => {
                const isDefault = ['minor', 'beginner', 'intermediate', 'advanced'].includes(level.id);
                const isEditing = editingLevelId === level.id;

                return (
                  <Animated.View
                    key={level.id}
                    entering={FadeInDown.delay(index * 40).duration(300)}
                    onLayout={(e) => { levelYPositions.current[level.id] = e.nativeEvent.layout.y; }}
                    className={cn('mb-3 rounded-2xl overflow-hidden', isDark ? 'bg-gray-900' : 'bg-white')}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.35 : 0.08,
                      shadowRadius: 8,
                      elevation: 4,
                    }}
                  >
                    {isEditing ? (
                      /* Edit form for this level */
                      <View className="p-4">
                        <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          Editing: {level.label}
                        </Text>
                        <View className="mb-3">
                          <Text className={cn('text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')}>
                            Display Name *
                          </Text>
                          <TextInput
                            value={editingLabel}
                            onChangeText={setEditingLabel}
                            placeholder="e.g. 'ōlelo, Haumāna, Pōki'i..."
                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                            className={cn(
                              'px-4 py-3 rounded-xl text-base',
                              isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                            )}
                            autoFocus
                            returnKeyType="next"
                          />
                        </View>
                        <View className="mb-4">
                          <Text className={cn('text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')}>
                            Description (optional)
                          </Text>
                          <TextInput
                            value={editingDescription}
                            onChangeText={setEditingDescription}
                            placeholder="Brief description of this level..."
                            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                            className={cn(
                              'px-4 py-3 rounded-xl text-base',
                              isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                            )}
                            returnKeyType="done"
                          />
                        </View>
                        <View className="flex-row gap-2">
                          <Pressable
                            onPress={handleCancelEditLevel}
                            className={cn('flex-1 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                          >
                            <Text className={cn('font-semibold text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                              Cancel
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={handleSaveEditLevel}
                            disabled={!editingLabel.trim()}
                            className="flex-1 py-3 rounded-xl items-center flex-row justify-center"
                            style={{
                              backgroundColor: editingLabel.trim() ? theme.primary : `${theme.primary}50`,
                              shadowColor: theme.primary,
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: editingLabel.trim() ? 0.3 : 0,
                              shadowRadius: 8,
                              elevation: editingLabel.trim() ? 6 : 0,
                            }}
                          >
                            <Check size={16} color="white" />
                            <Text className="text-white font-semibold text-sm ml-1.5">Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      /* Display row for this level */
                      <View className="flex-row items-center px-4 py-3.5">
                        <View
                          className="w-9 h-9 rounded-xl items-center justify-center mr-3"
                          style={{ backgroundColor: `${theme.primary}15` }}
                        >
                          <GraduationCap size={18} color={theme.primary} />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center gap-2">
                            <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                              {level.label}
                            </Text>
                            {isDefault && (
                              <View className={cn('px-2 py-0.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}>
                                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                  Default
                                </Text>
                              </View>
                            )}
                          </View>
                          {level.description ? (
                            <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-500' : 'text-gray-400')}>
                              {level.description}
                            </Text>
                          ) : null}
                        </View>
                        {/* Edit button */}
                        <Pressable
                          onPress={() => handleStartEditLevel(level.id, level.label, level.description)}
                          className="w-8 h-8 items-center justify-center rounded-lg active:opacity-60 mr-1"
                          style={{ backgroundColor: `${theme.primary}15` }}
                        >
                          <Edit3 size={15} color={theme.primary} />
                        </Pressable>
                        {/* Delete button — disabled for defaults */}
                        <Pressable
                          onPress={() => handleDeleteLevel(level.id, level.label)}
                          className="w-8 h-8 items-center justify-center rounded-lg active:opacity-60"
                          style={{ backgroundColor: isDefault ? (isDark ? '#1F2937' : '#F3F4F6') : '#EF444415' }}
                        >
                          <Trash2 size={15} color={isDefault ? (isDark ? '#4B5563' : '#9CA3AF') : '#EF4444'} />
                        </Pressable>
                      </View>
                    )}
                  </Animated.View>
                );
              })}
            </View>

            {/* Add new level section */}
            <View className="px-5">
              {showAddLevel ? (
                <Animated.View
                  entering={FadeInDown.duration(300)}
                  className={cn('rounded-2xl p-4 mb-4', isDark ? 'bg-gray-900' : 'bg-white')}
                  style={{
                    shadowColor: theme.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 6,
                  }}
                >
                  <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    New Level
                  </Text>
                  <View className="mb-3">
                    <Text className={cn('text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Display Name *
                    </Text>
                    <TextInput
                      value={newLevelLabel}
                      onChangeText={setNewLevelLabel}
                      placeholder="e.g. Ha'a, 'Ōlelo Hula..."
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      className={cn(
                        'px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      autoFocus
                      returnKeyType="next"
                    />
                  </View>
                  <View className="mb-4">
                    <Text className={cn('text-sm font-medium mb-1.5', isDark ? 'text-gray-300' : 'text-gray-700')}>
                      Description (optional)
                    </Text>
                    <TextInput
                      value={newLevelDescription}
                      onChangeText={setNewLevelDescription}
                      placeholder="Brief description..."
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      className={cn(
                        'px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      returnKeyType="done"
                    />
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => {
                        setShowAddLevel(false);
                        setNewLevelLabel('');
                        setNewLevelDescription('');
                      }}
                      className={cn('flex-1 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                    >
                      <Text className={cn('font-semibold text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleAddLevel}
                      disabled={!newLevelLabel.trim()}
                      className="flex-1 py-3 rounded-xl items-center flex-row justify-center"
                      style={{
                        backgroundColor: newLevelLabel.trim() ? theme.primary : `${theme.primary}50`,
                        shadowColor: theme.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: newLevelLabel.trim() ? 0.3 : 0,
                        shadowRadius: 8,
                        elevation: newLevelLabel.trim() ? 6 : 0,
                      }}
                    >
                      <Plus size={16} color="white" />
                      <Text className="text-white font-semibold text-sm ml-1.5">Add Level</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              ) : (
                <Pressable
                  onPress={() => setShowAddLevel(true)}
                  className={cn(
                    'flex-row items-center justify-center py-3.5 rounded-2xl border-2 border-dashed mb-4 active:opacity-70',
                    isDark ? 'border-gray-700' : 'border-gray-300'
                  )}
                >
                  <Plus size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text className={cn('font-semibold ml-2 text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    Add Custom Level
                  </Text>
                </Pressable>
              )}

              <Text className={cn('text-xs text-center', isDark ? 'text-gray-600' : 'text-gray-400')}>
                Default levels (Minors, Beginner, Intermediate, Advanced) can be renamed but not deleted.
              </Text>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </Modal>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowInviteModal(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Invite Members
            </Text>
            <View className="w-6" />
          </View>

          <View className="flex-1 px-5 py-8 items-center">
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-6"
              style={{ backgroundColor: `${theme.primary}15` }}
            >
              <Share2 size={40} color={theme.primary} />
            </View>

            <Text className={cn('text-xl font-bold text-center mb-2', isDark ? 'text-white' : 'text-gray-900')}>
              Share Invite Code
            </Text>
            <Text className={cn('text-center mb-8', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Share this code with new members to join {halau?.name}
            </Text>

            <View
              className={cn(
                'w-full rounded-2xl p-6 items-center mb-6',
                isDark ? 'bg-gray-900/80' : 'bg-gray-100'
              )}
            >
              <Text className={cn('text-4xl font-bold tracking-[0.3em]', isDark ? 'text-white' : 'text-gray-900')}>
                {halau?.inviteCode}
              </Text>
            </View>

            <Pressable
              onPress={copyInviteCode}
              className="flex-row items-center px-6 py-3 rounded-full"
              style={{ backgroundColor: copied ? '#10B981' : theme.primary }}
            >
              {copied ? (
                <>
                  <Check size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Copied!</Text>
                </>
              ) : (
                <>
                  <Copy size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Copy Code</Text>
                </>
              )}
            </Pressable>

            <View className={cn('mt-8 p-4 rounded-xl', isDark ? 'bg-gray-900/80' : 'bg-gray-100')}>
              <Text className={cn('text-sm text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                New members will need to create an account and enter this code to request to join your school.
                You'll need to approve each request.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function MoreScreen() {
  return (
    <ErrorBoundary>
      <MoreScreenInner />
    </ErrorBoundary>
  );
}
