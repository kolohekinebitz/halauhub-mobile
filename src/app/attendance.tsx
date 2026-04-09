import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Calendar,
  Check,
  X,
  Clock,
  AlertCircle,
  ChevronDown,
  User,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import type { Attendance } from '@/lib/types';
import * as Haptics from 'expo-haptics';

type AttendanceStatus = Attendance['status'];

export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getEventsByHalau = useAppStore((s) => s.getEventsByHalau);
  const getMembersByHalau = useAppStore((s) => s.getMembersByHalau);
  const getAttendanceByEvent = useAppStore((s) => s.getAttendanceByEvent);
  const markAttendance = useAppStore((s) => s.markAttendance);
  // Subscribe directly to attendances slice so the component re-renders immediately
  // whenever markAttendance updates the store
  useAppStore((s) => s.attendances);

  // Fetch fresh attendance from Firestore
  const fetchAttendance = useCallback(async () => {
    if (!currentHalauId) return;
    const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return;
    try {
      const r = await fetch(`${backendUrl}/api/user/school/${encodeURIComponent(currentHalauId)}/attendance`);
      if (!r.ok) return;
      const json = await r.json() as { data: Record<string, unknown>[] | null };
      const docs = json?.data;
      if (!Array.isArray(docs) || docs.length === 0) return;
      useAppStore.setState((state) => {
        const merged = [...state.attendances];
        for (const doc of docs) {
          const id = (doc.id as string) ?? '';
          if (!id) continue;
          const idx = merged.findIndex((a) => a.id === id);
          if (idx >= 0) {
            const remoteAt = (doc.markedAt as string) ?? '';
            if (remoteAt > (merged[idx].markedAt ?? '')) {
              merged[idx] = { ...merged[idx], ...doc } as typeof merged[0];
            }
          } else {
            merged.push(doc as unknown as typeof merged[0]);
          }
        }
        return { attendances: merged };
      });
    } catch (e) {
      console.warn('[attendance] fetch failed:', e);
    }
  }, [currentHalauId]);

  // Auto-fetch on mount and whenever the screen becomes active
  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAttendance();
    setRefreshing(false);
  }, [fetchAttendance]);

  const events = currentHalauId ? getEventsByHalau(currentHalauId) : [];
  const members = currentHalauId ? getMembersByHalau(currentHalauId) : [];

  // Sort events: today's events first, then future events (ascending), then past events (descending)
  const today = startOfDay(new Date());
  const sortedEvents = [...events].sort((a, b) => {
    const dateA = parseISO(a.date);
    const dateB = parseISO(b.date);
    const isATodayEvent = isToday(dateA);
    const isBTodayEvent = isToday(dateB);
    const isAPast = isBefore(dateA, today);
    const isBPast = isBefore(dateB, today);

    // Today's events come first
    if (isATodayEvent && !isBTodayEvent) return -1;
    if (!isATodayEvent && isBTodayEvent) return 1;

    // Then future events (ascending order - nearest first)
    if (!isAPast && !isBPast) {
      return a.date.localeCompare(b.date);
    }

    // Then past events (descending order - most recent first)
    if (isAPast && isBPast) {
      return b.date.localeCompare(a.date);
    }

    // Future events before past events
    if (!isAPast && isBPast) return -1;
    if (isAPast && !isBPast) return 1;

    return 0;
  });

  // Default to today's event if available, otherwise the first event in sorted list
  const todayEvent = sortedEvents.find((e) => isToday(parseISO(e.date)));
  const selectedEvent = selectedEventId
    ? events.find((e) => e.id === selectedEventId)
    : todayEvent || sortedEvents[0];

  const attendances = selectedEvent ? getAttendanceByEvent(selectedEvent.id) : [];

  const getMemberAttendance = (memberId: string): AttendanceStatus | null => {
    const attendance = attendances.find((a) => a.memberId === memberId);
    return attendance?.status || null;
  };

  const handleMarkAttendance = (memberId: string, status: AttendanceStatus) => {
    if (!selectedEvent) return;
    markAttendance(selectedEvent.id, memberId, status);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getStatusColor = (status: AttendanceStatus | null) => {
    switch (status) {
      case 'present':
        return { bg: 'bg-green-500', text: 'text-green-500' };
      case 'absent':
        return { bg: 'bg-red-500', text: 'text-red-500' };
      case 'late':
        return { bg: 'bg-amber-500', text: 'text-amber-500' };
      case 'excused':
        return { bg: 'bg-blue-500', text: 'text-blue-500' };
      default:
        return { bg: isDark ? 'bg-gray-600' : 'bg-gray-300', text: 'text-gray-400' };
    }
  };

  const StatusButton = ({
    status,
    currentStatus,
    memberId,
    icon,
  }: {
    status: AttendanceStatus;
    currentStatus: AttendanceStatus | null;
    memberId: string;
    icon: React.ReactNode;
  }) => {
    const isSelected = currentStatus === status;
    const color = getStatusColor(status);

    return (
      <Pressable
        onPress={() => handleMarkAttendance(memberId, status)}
        className={cn(
          'w-10 h-10 rounded-full items-center justify-center',
          isSelected ? color.bg : isDark ? 'bg-gray-700' : 'bg-gray-100'
        )}
      >
        {icon}
      </Pressable>
    );
  };

  const presentCount = attendances.filter((a) => a.status === 'present').length;
  const absentCount = attendances.filter((a) => a.status === 'absent').length;
  const lateCount = attendances.filter((a) => a.status === 'late').length;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Attendance',
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        {/* Event Selector */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-900' : 'bg-white')}>
          <Pressable
            onPress={() => setShowEventPicker(!showEventPicker)}
            className={cn(
              'flex-row items-center p-4 rounded-2xl',
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            )}
          >
            <View className="w-12 h-12 rounded-xl bg-teal-500/10 items-center justify-center mr-4">
              <Calendar size={24} color="#0D9488" />
            </View>
            <View className="flex-1">
              {selectedEvent ? (
                <>
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    {selectedEvent.title}
                  </Text>
                  <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {format(parseISO(selectedEvent.date), 'EEEE, MMMM d')} • {selectedEvent.startTime}
                  </Text>
                </>
              ) : (
                <Text className={cn(isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Select an event
                </Text>
              )}
            </View>
            <ChevronDown size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
          </Pressable>

          {/* Event Picker Dropdown */}
          {showEventPicker && (
            <View className={cn('mt-2 rounded-2xl overflow-hidden', isDark ? 'bg-gray-800' : 'bg-white')}>
              <ScrollView style={{ maxHeight: 200 }}>
                {sortedEvents.map((event) => {
                  const eventDate = parseISO(event.date);
                  const isTodayEvent = isToday(eventDate);

                  return (
                    <Pressable
                      key={event.id}
                      onPress={() => {
                        setSelectedEventId(event.id);
                        setShowEventPicker(false);
                      }}
                      className={cn(
                        'p-4 border-b',
                        isDark ? 'border-gray-700' : 'border-gray-100',
                        selectedEvent?.id === event.id && (isDark ? 'bg-gray-700' : 'bg-gray-50')
                      )}
                    >
                      <View className="flex-row items-center">
                        <Text className={cn('font-medium flex-1', isDark ? 'text-white' : 'text-gray-900')}>
                          {event.title}
                        </Text>
                        {isTodayEvent && (
                          <View className="bg-teal-500 px-2 py-0.5 rounded-full ml-2">
                            <Text className="text-white text-xs font-semibold">Today</Text>
                          </View>
                        )}
                      </View>
                      <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {format(eventDate, 'MMM d, yyyy')} • {event.startTime}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {selectedEvent ? (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {/* Stats */}
            <View className="flex-row gap-3 mb-4">
              <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-800' : 'bg-white')}>
                <Text className="text-green-500 text-xl font-bold">{presentCount}</Text>
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Present</Text>
              </View>
              <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-800' : 'bg-white')}>
                <Text className="text-amber-500 text-xl font-bold">{lateCount}</Text>
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Late</Text>
              </View>
              <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-800' : 'bg-white')}>
                <Text className="text-red-500 text-xl font-bold">{absentCount}</Text>
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Absent</Text>
              </View>
              <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-800' : 'bg-white')}>
                <Text className={cn('text-xl font-bold', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {members.length - presentCount - absentCount - lateCount}
                </Text>
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Unmarked</Text>
              </View>
            </View>

            {/* Legend */}
            <View className="flex-row items-center justify-center gap-4 mb-4">
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-green-500 mr-1.5" />
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Present</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-amber-500 mr-1.5" />
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Late</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-red-500 mr-1.5" />
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Absent</Text>
              </View>
              <View className="flex-row items-center">
                <View className="w-3 h-3 rounded-full bg-blue-500 mr-1.5" />
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Excused</Text>
              </View>
            </View>

            {/* Member List */}
            {members.map((member, index) => {
              const status = getMemberAttendance(member.id);

              return (
                <Animated.View
                  key={member.id}
                  entering={FadeInDown.delay(index * 30).duration(400)}
                >
                  <View
                    className={cn(
                      'flex-row items-center p-4 rounded-2xl mb-2',
                      isDark ? 'bg-gray-800/80' : 'bg-white'
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
                      className={cn(
                        'w-10 h-10 rounded-full items-center justify-center mr-3',
                        member.role === 'teacher' ? 'bg-amber-500' : 'bg-teal-500'
                      )}
                    >
                      <Text className="text-white font-bold">
                        {member.firstName[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {member.firstName} {member.lastName}
                      </Text>
                      <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        {member.role}
                      </Text>
                    </View>

                    {/* Attendance Buttons */}
                    <View className="flex-row gap-2">
                      <StatusButton
                        status="present"
                        currentStatus={status}
                        memberId={member.id}
                        icon={<Check size={18} color={status === 'present' ? 'white' : '#10B981'} />}
                      />
                      <StatusButton
                        status="late"
                        currentStatus={status}
                        memberId={member.id}
                        icon={<Clock size={18} color={status === 'late' ? 'white' : '#F59E0B'} />}
                      />
                      <StatusButton
                        status="absent"
                        currentStatus={status}
                        memberId={member.id}
                        icon={<X size={18} color={status === 'absent' ? 'white' : '#EF4444'} />}
                      />
                      <StatusButton
                        status="excused"
                        currentStatus={status}
                        memberId={member.id}
                        icon={<AlertCircle size={18} color={status === 'excused' ? 'white' : '#3B82F6'} />}
                      />
                    </View>
                  </View>
                </Animated.View>
              );
            })}

            {members.length === 0 && (
              <View className={cn('rounded-2xl p-8 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
                <User size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
                <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  No members to mark attendance
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Calendar size={64} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text className={cn('mt-4 text-center text-lg', isDark ? 'text-gray-400' : 'text-gray-500')}>
              No events available
            </Text>
            <Text className={cn('mt-2 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Create an event first to mark attendance
            </Text>
          </View>
        )}
      </View>
    </>
  );
}
