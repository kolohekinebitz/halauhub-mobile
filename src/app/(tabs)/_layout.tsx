import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { LayoutDashboard, MessageCircle, Calendar, Video, MoreHorizontal } from 'lucide-react-native';
import { View, Platform } from 'react-native';
import { useAppStore, useShallow } from '@/lib/store';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { fs, ms, TAB_BAR_HEIGHT, isSmallDevice } from '@/lib/scaling';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Store selectors - primitives selected individually to avoid unnecessary re-renders
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  // Subscribe directly to members for real-time pending badge updates
  const storeMembers = useAppStore((s) => s.members);

  // Compute totalUnread as a single number directly in the selector.
  // This avoids subscribing to the full chatMessages array (which re-renders on every message)
  // — the tab bar only needs to know the count, not the messages themselves.
  const totalUnread = useAppStore((s) => {
    const memberId = s.currentMember?.id;
    if (!memberId) return 0;
    const visibleChannelIds = s.chatChannels
      .filter((c) => {
        if (c.halauId !== s.currentHalauId) return false;
        if (c.type === 'halau') return true;
        if (c.createdBy === memberId) return true;
        return c.memberIds.includes(memberId);
      })
      .map((c) => c.id);
    return s.chatMessages.filter(
      (m) => visibleChannelIds.includes(m.channelId) && !m.readBy.includes(memberId)
    ).length;
  });

  // Store actions - grouped with useShallow
  const storeActions = useAppStore(useShallow((s) => ({
    getHalau: s.getHalau,
    getKeikiByGuardian: s.getKeikiByGuardian,
    getPendingMembers: s.getPendingMembers,
    isKumu: s.isKumu,
  })));

  const { getHalau, getKeikiByGuardian, getPendingMembers, isKumu } = storeActions;

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Check if user has restricted access
  // Guardians are never restricted — they always have access through their keiki
  const myKeiki = useMemo(() => currentMember ? getKeikiByGuardian(currentMember.id) : [], [currentMember, getKeikiByGuardian]);
  const isGuardian = currentMember?.role === 'guardian';
  const isStudent = currentMember?.role === 'student';
  const hasClassLevel = currentMember?.classLevel && currentMember.classLevel !== '';
  const isRestrictedAccess = isStudent && !hasClassLevel;

  // Pending members badge — only visible to teachers/admins, reacts in real-time to store updates
  const isTeacher = isKumu();
  const pendingMembersCount = useMemo(() =>
    isTeacher && currentHalauId ? getPendingMembers(currentHalauId).length : 0,
    [isTeacher, currentHalauId, getPendingMembers, storeMembers]
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: isDark ? '#6B6B6B' : '#9CA3AF',
        tabBarStyle: {
          backgroundColor: isDark ? '#000000' : '#FFFFFF',
          borderTopColor: isDark ? '#1A1A1A' : '#E8E8E8',
          borderTopWidth: 1,
          paddingTop: ms(6),
          paddingBottom: Platform.OS === 'ios' ? ms(24) : ms(8),
          height: TAB_BAR_HEIGHT,
        },
        tabBarLabelStyle: {
          fontSize: fs(11),
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: isDark ? '#000000' : '#FFFFFF',
        },
        headerTintColor: isDark ? '#FFFFFF' : '#111827',
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-70'}>
              <LayoutDashboard size={ms(24)} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarBadge: pendingMembersCount > 0 ? pendingMembersCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: fs(10),
            minWidth: ms(18),
            height: ms(18),
          },
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-70'}>
              <MessageCircle size={ms(24)} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
          tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            fontSize: fs(10),
            minWidth: ms(18),
            height: ms(18),
          },
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          headerShown: false,
          href: isRestrictedAccess ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-70'}>
              <Calendar size={ms(24)} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: 'Videos',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-70'}>
              <Video size={ms(24)} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerShown: false,
          // Always show More tab so users can access Sign Out
          tabBarIcon: ({ color, focused }) => (
            <View className={focused ? 'opacity-100' : 'opacity-70'}>
              <MoreHorizontal size={ms(24)} color={color} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      {/* Hide the two.tsx tab */}
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
