import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import {
  X,
  Crown,
  Check,
  Sparkles,
  Users,
  Calendar,
  Video,
  Shield,
  UserCog,
  Palette,
  MessageCircle,
  FileText,
  ClipboardCheck,
  RefreshCw,
  GraduationCap,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatEnabled,
} from '@/lib/revenuecatClient';
import {
  RC_TEACHER_PACKAGE_ID,
  RC_ADMIN_PACKAGE_ID,
  TEACHER_PRICE_FALLBACK,
  ADMIN_PRICE_FALLBACK,
  SUBSCRIPTION_TIERS,
} from '@/lib/subscription';
import { useSubscription } from '@/lib/useSubscription';
import type { PurchasesPackage } from 'react-native-purchases';
import { s, ms, screenWidth as SCREEN_WIDTH } from '@/lib/scaling';

const TEACHER_FEATURES = [
  { icon: Users,          text: 'Unlimited students & members' },
  { icon: Users,          text: 'Member management & approvals' },
  { icon: Calendar,       text: 'Event creation & RSVP tracking' },
  { icon: Video,          text: 'Video library & uploads' },
  { icon: Shield,         text: 'Financial dues & payments' },
  { icon: MessageCircle,  text: 'Chat channels & announcements' },
  { icon: FileText,       text: 'Digital waivers & documents' },
  { icon: UserCog,        text: 'Admin roles & permissions' },
  { icon: Palette,        text: 'Custom school branding' },
];

const ADMIN_FEATURES = [
  { icon: Users,          text: 'Unlimited students & members' },
  { icon: Users,          text: 'Member management & approvals' },
  { icon: Calendar,       text: 'Event creation & RSVP tracking' },
  { icon: Video,          text: 'Video library & uploads' },
  { icon: Shield,         text: 'Financial dues & payments' },
  { icon: MessageCircle,  text: 'Chat channels & announcements' },
  { icon: FileText,       text: 'Digital waivers & documents' },
  { icon: UserCog,        text: 'Admin roles & permissions' },
];

type PlanKey = 'teacher' | 'admin';

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { status, trialDaysLeft, refresh, isTeacherRole } = useSubscription();

  // Default plan tab to the user's role
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>(isTeacherRole ? 'teacher' : 'admin');

  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [teacherPackage, setTeacherPackage] = useState<PurchasesPackage | null>(null);
  const [adminPackage, setAdminPackage] = useState<PurchasesPackage | null>(null);

  // Animations
  const shimmerPosition = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.28, { duration: 2400, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const loadOfferings = useCallback(async () => {
    if (!isRevenueCatEnabled()) {
      setIsLoadingPackages(false);
      return;
    }

    // Race getOfferings against a 10-second timeout so the user never
    // sees an infinite spinner when RevenueCat is unreachable.
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 10_000)
    );

    const result = await Promise.race([getOfferings(), timeoutPromise]);

    if (result && result.ok && result.data.current) {
      const pkgs = result.data.current.availablePackages;
      setTeacherPackage(pkgs.find((p) => p.identifier === RC_TEACHER_PACKAGE_ID) ?? null);
      setAdminPackage(pkgs.find((p) => p.identifier === RC_ADMIN_PACKAGE_ID) ?? null);
    }
    // Falls through with null packages → UI shows price fallback strings and
    // the purchase button shows "Unavailable" — acceptable offline UX.
    setIsLoadingPackages(false);
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const handlePurchase = async () => {
    const pkg = selectedPlan === 'teacher' ? teacherPackage : adminPackage;
    if (!pkg) {
      Alert.alert('Unavailable', 'Subscription package could not be loaded. Please try again.');
      return;
    }
    setIsPurchasing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await purchasePackage(pkg);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      const planName = selectedPlan === 'teacher' ? 'School Owner' : 'School Admin';
      Alert.alert(
        `Welcome to ${planName}!`,
        'Your subscription is active. Enjoy all features.',
        [{ text: 'Continue', onPress: () => router.back() }]
      );
    } else if (result.reason === 'sdk_error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const errMsg = result.error instanceof Error
        ? result.error.message
        : 'Something went wrong. Please try again.';
      Alert.alert('Purchase Failed', errMsg);
    }
    setIsPurchasing(false);
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await restorePurchases();
    if (result.ok) {
      const hasActive = Object.keys(result.data.entitlements?.active ?? {}).length > 0;
      if (hasActive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await refresh();
        Alert.alert('Restored!', 'Your subscription has been restored.', [
          { text: 'Continue', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('No Subscription Found', 'No previous subscription was found to restore.');
      }
    } else {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    }
    setIsRestoring(false);
  };

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmerPosition.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]) }],
  }));
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));
  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const isTeacherPlan = selectedPlan === 'teacher';
  const currentPkg = isTeacherPlan ? teacherPackage : adminPackage;
  const priceString = isTeacherPlan
    ? (teacherPackage?.product?.priceString ?? TEACHER_PRICE_FALLBACK)
    : (adminPackage?.product?.priceString ?? ADMIN_PRICE_FALLBACK);
  const currentFeatures = isTeacherPlan ? TEACHER_FEATURES : ADMIN_FEATURES;
  const planLabel = isTeacherPlan ? SUBSCRIPTION_TIERS.owner_teacher.name : SUBSCRIPTION_TIERS.owner_admin.name;
  const planDescription = isTeacherPlan
    ? SUBSCRIPTION_TIERS.owner_teacher.description
    : SUBSCRIPTION_TIERS.owner_admin.description;

  const isAlreadyActive = status === 'active';
  const isTrialing = status === 'trialing';
  const isBusy = isPurchasing || isLoadingPackages;

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Background */}
      <LinearGradient
        colors={isDark
          ? ['#000000', '#071a14', '#0a1f1a', '#000000']
          : ['#f0fdf9', '#d1fae5', '#ccfbf1', '#f0fdf9']
        }
        locations={[0, 0.3, 0.65, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Ambient blobs */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: ms(80),
            right: ms(-60),
            width: ms(220),
            height: ms(220),
            borderRadius: ms(110),
            backgroundColor: '#0d9488',
          },
          glowAnimatedStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: ms(160),
            left: ms(-90),
            width: ms(260),
            height: ms(260),
            borderRadius: ms(130),
            backgroundColor: '#059669',
          },
          glowAnimatedStyle,
        ]}
      />

      <View className="flex-1" style={{ paddingTop: insets.top }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            }}
          >
            <X size={22} color={isDark ? '#FFFFFF' : '#111827'} />
          </Pressable>

          <Pressable
            onPress={handleRestore}
            disabled={isRestoring}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            }}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#111827'} />
            ) : (
              <View className="flex-row items-center gap-1.5">
                <RefreshCw size={13} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
                  Restore
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}
        >
          {/* Hero */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(600).springify()}
            className="items-center mt-2 mb-6"
          >
            <LinearGradient
              colors={['#fbbf24', '#f59e0b', '#d97706']}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#f59e0b',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.45,
                shadowRadius: 18,
                elevation: 10,
              }}
            >
              <Crown size={34} color="#FFFFFF" strokeWidth={2} />
            </LinearGradient>

            <Text
              className={cn('text-[26px] font-bold text-center mt-4 mb-1', isDark ? 'text-white' : 'text-gray-900')}
            >
              Choose Your Plan
            </Text>
            <Text className={cn('text-sm text-center px-4 leading-5', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Teachers & admins unlock full management tools
            </Text>

            {/* 14-day trial banner */}
            {!isAlreadyActive && !isTrialing && (
              <Animated.View
                entering={FadeInDown.delay(120).duration(500).springify()}
                style={{
                  marginTop: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  borderRadius: 18,
                  backgroundColor: isDark ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.12)',
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(251,191,36,0.35)' : 'rgba(245,158,11,0.4)',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Sparkles size={18} color="#f59e0b" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 14 }}>
                    2-Week Free Trial Included
                  </Text>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)', fontSize: 12, marginTop: 2 }}>
                    Try everything free — no charge for 2 weeks
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Status badges */}
            {isAlreadyActive && (
              <Animated.View
                entering={FadeIn.delay(200).duration(400)}
                style={{
                  marginTop: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: 'rgba(16,185,129,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(16,185,129,0.3)',
                }}
              >
                <Text style={{ color: '#10b981', fontWeight: '600', fontSize: 13 }}>
                  Subscription Active
                </Text>
              </Animated.View>
            )}

            {isTrialing && !isAlreadyActive && (
              <Animated.View
                entering={FadeIn.delay(200).duration(400)}
                style={{
                  marginTop: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: 'rgba(245,158,11,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.3)',
                }}
              >
                <Text style={{ color: '#f59e0b', fontWeight: '600', fontSize: 13 }}>
                  {trialDaysLeft > 0 ? `${trialDaysLeft} days left in free trial` : 'Free trial active'}
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Plan toggle */}
          <Animated.View
            entering={FadeInDown.delay(160).duration(500).springify()}
            className="mb-5"
          >
            <View
              style={{
                flexDirection: 'row',
                padding: 4,
                borderRadius: 18,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              }}
            >
              {/* Teacher plan tab */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPlan('teacher');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: isTeacherPlan
                    ? '#0d9488'
                    : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <GraduationCap
                    size={14}
                    color={isTeacherPlan ? '#FFFFFF' : (isDark ? '#9ca3af' : '#6b7280')}
                  />
                  <Text
                    style={{
                      fontWeight: '700',
                      fontSize: 13,
                      color: isTeacherPlan ? '#FFFFFF' : (isDark ? '#9ca3af' : '#6b7280'),
                    }}
                  >
                    Teacher
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    marginTop: 2,
                    color: isTeacherPlan ? 'rgba(255,255,255,0.75)' : (isDark ? '#6b7280' : '#9ca3af'),
                  }}
                >
                  {teacherPackage?.product?.priceString ?? TEACHER_PRICE_FALLBACK}/mo
                </Text>
              </Pressable>

              {/* Admin plan tab */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPlan('admin');
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  alignItems: 'center',
                  backgroundColor: !isTeacherPlan
                    ? '#0d9488'
                    : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <UserCog
                    size={14}
                    color={!isTeacherPlan ? '#FFFFFF' : (isDark ? '#9ca3af' : '#6b7280')}
                  />
                  <Text
                    style={{
                      fontWeight: '700',
                      fontSize: 13,
                      color: !isTeacherPlan ? '#FFFFFF' : (isDark ? '#9ca3af' : '#6b7280'),
                    }}
                  >
                    Admin
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    marginTop: 2,
                    color: !isTeacherPlan ? 'rgba(255,255,255,0.75)' : (isDark ? '#6b7280' : '#9ca3af'),
                  }}
                >
                  {adminPackage?.product?.priceString ?? ADMIN_PRICE_FALLBACK}/mo
                </Text>
              </Pressable>
            </View>

            {/* Plan description blurb */}
            <Animated.View entering={FadeIn.duration(300)} key={selectedPlan}>
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 12,
                  marginTop: 10,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                }}
              >
                {isTeacherPlan
                  ? 'Full ownership — manage admins, branding & everything'
                  : 'Manage members, events, finances & communications'}
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Features */}
          <Animated.View entering={FadeIn.delay(240).duration(600)} className="mb-5">
            <BlurView
              intensity={isDark ? 40 : 60}
              tint={isDark ? 'dark' : 'light'}
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <View style={{ padding: 16 }}>
                <Text
                  className={cn(
                    'text-[11px] font-bold uppercase tracking-widest mb-4',
                    isDark ? 'text-teal-400' : 'text-teal-600'
                  )}
                >
                  Everything included
                </Text>

                {currentFeatures.map((feature, index) => (
                  <Animated.View
                    key={`${selectedPlan}-${feature.text}`}
                    entering={FadeInDown.delay(index * 40).duration(360).springify()}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: index < currentFeatures.length - 1 ? 13 : 0,
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                        backgroundColor: 'rgba(13,148,136,0.12)',
                      }}
                    >
                      <feature.icon size={16} color="#0d9488" />
                    </View>
                    <Text
                      className={cn('text-sm font-medium flex-1', isDark ? 'text-white' : 'text-gray-800')}
                    >
                      {feature.text}
                    </Text>
                    <Check size={15} color="#10b981" strokeWidth={2.5} />
                  </Animated.View>
                ))}

                {/* Branding callout for admin plan — not included */}
                {!isTeacherPlan && (
                  <Animated.View
                    entering={FadeInDown.delay(currentFeatures.length * 40).duration(360).springify()}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginTop: 13,
                      paddingTop: 13,
                      borderTopWidth: 1,
                      borderTopColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                        backgroundColor: 'rgba(107,114,128,0.1)',
                      }}
                    >
                      <Palette size={16} color={isDark ? '#6b7280' : '#9ca3af'} />
                    </View>
                    <Text style={{ fontSize: 13, flex: 1, color: isDark ? '#6b7280' : '#9ca3af' }}>
                      Custom school branding
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? '#6b7280' : '#9ca3af', fontStyle: 'italic' }}>
                      Teacher only
                    </Text>
                  </Animated.View>
                )}
              </View>
            </BlurView>
          </Animated.View>

          {/* Students callout */}
          <Animated.View entering={FadeInUp.delay(460).duration(540).springify()} className="mb-6">
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(16,185,129,0.12)',
                }}
              >
                <ClipboardCheck size={17} color="#10b981" />
              </View>
              <Text className={cn('text-sm flex-1 leading-5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                <Text className={cn('font-semibold', isDark ? 'text-gray-200' : 'text-gray-800')}>
                  Students & guardians
                </Text>
                {' '}always have full access for free — no subscription required.
              </Text>
            </View>
          </Animated.View>

          {/* CTA */}
          <Animated.View
            entering={FadeInUp.delay(540).duration(600).springify()}
            style={buttonAnimatedStyle}
          >
            {isAlreadyActive ? (
              <View
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <LinearGradient
                  colors={['#059669', '#047857', '#065f46']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center' }}
                >
                  <View className="flex-row items-center gap-2">
                    <Check size={20} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>
                      Subscription Active
                    </Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 }}>
                    All features unlocked
                  </Text>
                </LinearGradient>
              </View>
            ) : (
              <Pressable
                onPress={handlePurchase}
                disabled={isBusy || !currentPkg}
                style={{
                  borderRadius: 20,
                  overflow: 'hidden',
                  shadowColor: '#0d9488',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.38,
                  shadowRadius: 20,
                  elevation: 12,
                  opacity: (isBusy || !currentPkg) && !isLoadingPackages ? 0.6 : 1,
                }}
              >
                <LinearGradient
                  colors={['#0d9488', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingVertical: 18, paddingHorizontal: 24 }}
                >
                  {/* Shimmer */}
                  <Animated.View
                    style={[
                      {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        overflow: 'hidden',
                      },
                      shimmerStyle,
                    ]}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.18)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1, width: 120 }}
                    />
                  </Animated.View>

                  {isBusy ? (
                    <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                  ) : (
                    <>
                      <View className="flex-row items-center justify-center mb-1">
                        <Sparkles size={16} color="#fbbf24" />
                        <Text style={{ color: '#fde68a', fontWeight: '600', fontSize: 11, marginLeft: 6, letterSpacing: 1.2, textTransform: 'uppercase' }}>
                          {planLabel} Plan
                        </Text>
                      </View>

                      <View className="flex-row items-baseline justify-center">
                        <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '800' }}>
                          {priceString}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, marginLeft: 4 }}>
                          /month
                        </Text>
                      </View>

                      <Text style={{ color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 6, fontSize: 16, fontWeight: '700' }}>
                        Start Your 2-Week Free Trial
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 3, fontSize: 12 }}>
                        as {isTeacherPlan ? 'Teacher' : 'Admin'} · then {priceString}/mo
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            )}
          </Animated.View>

          {/* Footer — Apple-required IAP disclosures */}
          <Animated.View
            entering={FadeIn.delay(660).duration(600)}
            className="items-center mt-5"
          >
            {/* Auto-renewal disclosure (required by Apple guideline 3.1.2) */}
            <Text
              className={cn('text-xs text-center leading-[18px] mb-2', isDark ? 'text-gray-500' : 'text-gray-400')}
              style={{ paddingHorizontal: 4 }}
            >
              {isAlreadyActive || isTrialing ? null : (
                <>
                  <Text style={{ fontWeight: '600' }}>
                    {isTeacherPlan ? `${teacherPackage?.product?.priceString ?? TEACHER_PRICE_FALLBACK}` : `${adminPackage?.product?.priceString ?? ADMIN_PRICE_FALLBACK}`}/month
                  </Text>
                  {' '}after your free 2-week trial.{' '}
                </>
              )}
              Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel your subscription in your App Store account settings at any time after purchase. Any unused portion of a free trial period will be forfeited when a subscription is purchased.
            </Text>

            <View className="flex-row items-center mt-3 gap-4">
              <Pressable onPress={() => Linking.openURL('https://halauhub.com/terms')}>
                <Text className={cn('text-xs underline', isDark ? 'text-gray-600' : 'text-gray-400')}>
                  Terms of Use (EULA)
                </Text>
              </Pressable>
              <Text className={cn('text-xs', isDark ? 'text-gray-700' : 'text-gray-300')}>•</Text>
              <Pressable onPress={() => Linking.openURL('https://halauhub.com/privacy')}>
                <Text className={cn('text-xs underline', isDark ? 'text-gray-600' : 'text-gray-400')}>
                  Privacy Policy
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}
