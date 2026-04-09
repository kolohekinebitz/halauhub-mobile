import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Search,
  Plus,
  X,
  Check,
  Calendar,
  MapPin,
  Users,
  Star,
  ChevronDown,
  Clock,
  UserCheck,
  UserMinus,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import type { Show, Member } from '@/lib/types';
import * as Haptics from 'expo-haptics';

// Generate arrays for dropdowns
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear + i);

// Time options from 6:00 AM to 11:00 PM in 30-min increments
const TIME_OPTIONS: string[] = [];
for (let hour = 6; hour <= 23; hour++) {
  for (let min = 0; min < 60; min += 30) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    const m = min.toString().padStart(2, '0');
    TIME_OPTIONS.push(`${h}:${m} ${ampm}`);
  }
}

export default function ShowsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDancerSelection, setShowDancerSelection] = useState(false);

  // Form state
  const [showName, setShowName] = useState('');
  const [showDate, setShowDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [startTime, setStartTime] = useState('6:00 PM');
  const [endTime, setEndTime] = useState('9:00 PM');
  const [showLocation, setShowLocation] = useState('');
  const [showDescription, setShowDescription] = useState('');
  const [selectedDancers, setSelectedDancers] = useState<string[]>([]);

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getShowsByHalau = useAppStore((s) => s.getShowsByHalau);
  const getShowParticipants = useAppStore((s) => s.getShowParticipants);
  const getMembersByHalau = useAppStore((s) => s.getMembersByHalau);
  const createShow = useAppStore((s) => s.createShow);
  const addShowParticipant = useAppStore((s) => s.addShowParticipant);
  const isKumu = useAppStore((s) => s.isKumu);

  const shows = currentHalauId ? getShowsByHalau(currentHalauId) : [];
  const members = currentHalauId ? getMembersByHalau(currentHalauId) : [];
  const isTeacher = isKumu();

  const filteredShows = shows.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const upcomingShows = filteredShows
    .filter((s) => parseISO(s.date) >= new Date())
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastShows = filteredShows
    .filter((s) => parseISO(s.date) < new Date())
    .sort((a, b) => b.date.localeCompare(a.date));

  const closeAllPickers = () => {
    setShowDayPicker(false);
    setShowMonthPicker(false);
    setShowYearPicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
  };

  const toggleDancer = (memberId: string) => {
    setSelectedDancers((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleCreateShow = () => {
    if (!showName.trim() || !currentHalauId) return;

    const newShow = createShow({
      halauId: currentHalauId,
      name: showName.trim(),
      date: format(showDate, 'yyyy-MM-dd'),
      startTime: startTime,
      endTime: endTime || undefined,
      location: showLocation.trim(),
      description: showDescription.trim() || undefined,
    });

    // Add selected dancers as participants
    selectedDancers.forEach((memberId) => {
      addShowParticipant(newShow.id, memberId);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setShowName('');
    setShowDate(new Date());
    setSelectedDay(new Date().getDate());
    setSelectedMonth(new Date().getMonth());
    setSelectedYear(new Date().getFullYear());
    setStartTime('6:00 PM');
    setEndTime('9:00 PM');
    setShowLocation('');
    setShowDescription('');
    setSelectedDancers([]);
    setShowAddModal(false);
  };

  const ShowCard = ({ show, index, isPast }: { show: Show; index: number; isPast?: boolean }) => {
    const participants = getShowParticipants(show.id);

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <Pressable
          onPress={() => router.push(`/shows/${show.id}` as never)}
          className={cn(
            'rounded-2xl p-4 mb-3 active:opacity-80',
            isDark ? 'bg-gray-800/80' : 'bg-white',
            isPast && 'opacity-60'
          )}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.5 : 0.2,
            shadowRadius: 6,
            elevation: isDark ? 6 : 5,
          }}
        >
          <View className="flex-row items-start">
            <View className="w-14 h-14 rounded-xl bg-purple-500/10 items-center justify-center mr-4">
              <Star size={24} color="#8B5CF6" />
            </View>
            <View className="flex-1">
              <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                {show.name}
              </Text>
              <View className="flex-row items-center mt-1">
                <Calendar size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {format(parseISO(show.date), 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
              {show.startTime && (
                <View className="flex-row items-center mt-1">
                  <Clock size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {show.startTime}{show.endTime ? ` - ${show.endTime}` : ''}
                  </Text>
                </View>
              )}
              {show.location && (
                <View className="flex-row items-center mt-1">
                  <MapPin size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {show.location}
                  </Text>
                </View>
              )}
              <View className="flex-row items-center mt-2">
                <Users size={14} color="#8B5CF6" />
                <Text className="text-sm ml-1.5 text-purple-600">
                  {participants.length} performer{participants.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const DancerItem = ({ member }: { member: Member }) => {
    const isSelected = selectedDancers.includes(member.id);
    return (
      <Pressable
        onPress={() => toggleDancer(member.id)}
        className={cn(
          'flex-row items-center px-4 py-3 rounded-xl mb-2',
          isSelected
            ? 'bg-purple-500/20 border border-purple-500/50'
            : isDark ? 'bg-gray-800' : 'bg-gray-100'
        )}
      >
        <View
          className={cn(
            'w-10 h-10 rounded-full items-center justify-center mr-3',
            isSelected ? 'bg-purple-500' : isDark ? 'bg-gray-700' : 'bg-gray-300'
          )}
        >
          {isSelected ? (
            <UserCheck size={20} color="white" />
          ) : (
            <Text className={cn('text-lg font-bold', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {member.firstName.charAt(0)}
            </Text>
          )}
        </View>
        <View className="flex-1">
          <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
            {member.firstName} {member.lastName}
          </Text>
          <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {member.role === 'teacher' ? 'Teacher' : 'Student'}
          </Text>
        </View>
        {isSelected && (
          <View className="w-6 h-6 bg-purple-500 rounded-full items-center justify-center">
            <Check size={14} color="white" />
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Shows',
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        {/* Search */}
        <View className={cn('px-4 py-4', isDark ? 'bg-gray-900' : 'bg-white')}>
          <View
            className={cn(
              'flex-row items-center px-4 py-3 rounded-xl',
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            )}
          >
            <Search size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <TextInput
              className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
              placeholder="Search shows..."
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              cursorColor={isDark ? '#FFFFFF' : '#000000'}
              selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
          {/* Upcoming Shows */}
          {upcomingShows.length > 0 && (
            <>
              <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                Upcoming Shows
              </Text>
              {upcomingShows.map((show, index) => (
                <ShowCard key={show.id} show={show} index={index} />
              ))}
            </>
          )}

          {/* Past Shows */}
          {pastShows.length > 0 && (
            <>
              <Text className={cn('text-lg font-bold mb-3 mt-6', isDark ? 'text-white' : 'text-gray-900')}>
                Past Shows
              </Text>
              {pastShows.map((show, index) => (
                <ShowCard key={show.id} show={show} index={index} isPast />
              ))}
            </>
          )}

          {/* Empty State */}
          {shows.length === 0 && (
            <View className={cn('rounded-2xl p-8 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
              <Star size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
              <Text className={cn('mt-4 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                No shows yet
              </Text>
              <Text className={cn('text-sm text-center mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                Create a show to track performances
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Add Show FAB - only for Kumu */}
        {isTeacher && (
          <Pressable
            onPress={() => setShowAddModal(true)}
            className="absolute bottom-24 right-4 w-14 h-14 bg-purple-500 rounded-full items-center justify-center shadow-lg"
            style={{
              shadowColor: '#8B5CF6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Plus size={28} color="white" />
          </Pressable>
        )}

        {/* Add Show Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1 }} className={cn(isDark ? 'bg-gray-900' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => setShowAddModal(false)}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                New Show
              </Text>
              <Pressable
                onPress={handleCreateShow}
                disabled={!showName.trim()}
                className={cn(!showName.trim() && 'opacity-50')}
              >
                <Check size={24} color="#8B5CF6" />
              </Pressable>
            </View>

            <KeyboardAwareScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }} bottomOffset={16}>
              <Pressable onPress={closeAllPickers} className="gap-4">
                {/* Show Name */}
                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Show Name *
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="e.g., Ho'ike 2024"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={showName}
                    onChangeText={setShowName}
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>

                {/* Date Section */}
                <View style={{ zIndex: 100 }}>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Date
                  </Text>

                  {/* Date Display */}
                  <View className={cn('px-4 py-3 rounded-xl flex-row items-center mb-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <Calendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      {MONTHS[selectedMonth]} {selectedDay}, {selectedYear}
                    </Text>
                  </View>

                  {/* Day, Month, Year Dropdowns */}
                  <View className="flex-row gap-2">
                    {/* Month Dropdown */}
                    <View className="flex-1" style={{ zIndex: 103 }}>
                      <Text className={cn('text-xs font-medium mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Month
                      </Text>
                      <Pressable
                        onPress={() => {
                          setShowMonthPicker(!showMonthPicker);
                          setShowDayPicker(false);
                          setShowYearPicker(false);
                          setShowStartTimePicker(false);
                          setShowEndTimePicker(false);
                        }}
                        className={cn('px-3 py-2.5 rounded-lg flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                      >
                        <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')} numberOfLines={1}>
                          {MONTHS[selectedMonth].substring(0, 3)}
                        </Text>
                        <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                      {showMonthPicker && (
                        <View
                          className={cn('absolute top-14 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                          style={{ zIndex: 1000, elevation: 1000 }}
                        >
                          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                            {MONTHS.map((month, index) => (
                              <Pressable
                                key={month}
                                onPress={() => {
                                  setSelectedMonth(index);
                                  setShowMonthPicker(false);
                                  const newDate = new Date(selectedYear, index, Math.min(selectedDay, new Date(selectedYear, index + 1, 0).getDate()));
                                  setShowDate(newDate);
                                }}
                                className={cn(
                                  'px-3 py-2 border-b',
                                  isDark ? 'border-gray-600' : 'border-gray-100',
                                  selectedMonth === index && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                )}
                              >
                                <Text className={cn('text-sm', selectedMonth === index ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
                                  {month}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Day Dropdown */}
                    <View className="flex-1" style={{ zIndex: 102 }}>
                      <Text className={cn('text-xs font-medium mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Day
                      </Text>
                      <Pressable
                        onPress={() => {
                          setShowDayPicker(!showDayPicker);
                          setShowMonthPicker(false);
                          setShowYearPicker(false);
                          setShowStartTimePicker(false);
                          setShowEndTimePicker(false);
                        }}
                        className={cn('px-3 py-2.5 rounded-lg flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                      >
                        <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                          {selectedDay}
                        </Text>
                        <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                      {showDayPicker && (
                        <View
                          className={cn('absolute top-14 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                          style={{ zIndex: 1000, elevation: 1000 }}
                        >
                          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                            {DAYS.map((day) => {
                              const maxDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                              if (day > maxDay) return null;
                              return (
                                <Pressable
                                  key={day}
                                  onPress={() => {
                                    setSelectedDay(day);
                                    setShowDayPicker(false);
                                    const newDate = new Date(selectedYear, selectedMonth, day);
                                    setShowDate(newDate);
                                  }}
                                  className={cn(
                                    'px-3 py-2 border-b',
                                    isDark ? 'border-gray-600' : 'border-gray-100',
                                    selectedDay === day && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                  )}
                                >
                                  <Text className={cn('text-sm', selectedDay === day ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
                                    {day}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* Year Dropdown */}
                    <View className="flex-1" style={{ zIndex: 101 }}>
                      <Text className={cn('text-xs font-medium mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Year
                      </Text>
                      <Pressable
                        onPress={() => {
                          setShowYearPicker(!showYearPicker);
                          setShowMonthPicker(false);
                          setShowDayPicker(false);
                          setShowStartTimePicker(false);
                          setShowEndTimePicker(false);
                        }}
                        className={cn('px-3 py-2.5 rounded-lg flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                      >
                        <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                          {selectedYear}
                        </Text>
                        <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                      {showYearPicker && (
                        <View
                          className={cn('absolute top-14 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                          style={{ zIndex: 1000, elevation: 1000 }}
                        >
                          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                            {YEARS.map((year) => (
                              <Pressable
                                key={year}
                                onPress={() => {
                                  setSelectedYear(year);
                                  setShowYearPicker(false);
                                  const newDate = new Date(year, selectedMonth, Math.min(selectedDay, new Date(year, selectedMonth + 1, 0).getDate()));
                                  setShowDate(newDate);
                                }}
                                className={cn(
                                  'px-3 py-2 border-b',
                                  isDark ? 'border-gray-600' : 'border-gray-100',
                                  selectedYear === year && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                )}
                              >
                                <Text className={cn('text-sm', selectedYear === year ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
                                  {year}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Time Section */}
                <View style={{ zIndex: 90 }}>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Time
                  </Text>
                  <View className="flex-row gap-3">
                    {/* Start Time */}
                    <View className="flex-1" style={{ zIndex: 92 }}>
                      <Text className={cn('text-xs font-medium mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        Start Time
                      </Text>
                      <Pressable
                        onPress={() => {
                          setShowStartTimePicker(!showStartTimePicker);
                          setShowEndTimePicker(false);
                          setShowMonthPicker(false);
                          setShowDayPicker(false);
                          setShowYearPicker(false);
                        }}
                        className={cn('px-3 py-2.5 rounded-lg flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                      >
                        <View className="flex-row items-center">
                          <Clock size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={cn('text-sm ml-2', isDark ? 'text-white' : 'text-gray-900')}>
                            {startTime}
                          </Text>
                        </View>
                        <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                      {showStartTimePicker && (
                        <View
                          className={cn('absolute top-14 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                          style={{ zIndex: 1000, elevation: 1000 }}
                        >
                          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                            {TIME_OPTIONS.map((time) => (
                              <Pressable
                                key={time}
                                onPress={() => {
                                  setStartTime(time);
                                  setShowStartTimePicker(false);
                                }}
                                className={cn(
                                  'px-3 py-2 border-b',
                                  isDark ? 'border-gray-600' : 'border-gray-100',
                                  startTime === time && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                )}
                              >
                                <Text className={cn('text-sm', startTime === time ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
                                  {time}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* End Time */}
                    <View className="flex-1" style={{ zIndex: 91 }}>
                      <Text className={cn('text-xs font-medium mb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        End Time
                      </Text>
                      <Pressable
                        onPress={() => {
                          setShowEndTimePicker(!showEndTimePicker);
                          setShowStartTimePicker(false);
                          setShowMonthPicker(false);
                          setShowDayPicker(false);
                          setShowYearPicker(false);
                        }}
                        className={cn('px-3 py-2.5 rounded-lg flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                      >
                        <View className="flex-row items-center">
                          <Clock size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={cn('text-sm ml-2', isDark ? 'text-white' : 'text-gray-900')}>
                            {endTime}
                          </Text>
                        </View>
                        <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                      {showEndTimePicker && (
                        <View
                          className={cn('absolute top-14 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                          style={{ zIndex: 1000, elevation: 1000 }}
                        >
                          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                            {TIME_OPTIONS.map((time) => (
                              <Pressable
                                key={time}
                                onPress={() => {
                                  setEndTime(time);
                                  setShowEndTimePicker(false);
                                }}
                                className={cn(
                                  'px-3 py-2 border-b',
                                  isDark ? 'border-gray-600' : 'border-gray-100',
                                  endTime === time && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                )}
                              >
                                <Text className={cn('text-sm', endTime === time ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
                                  {time}
                                </Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Location */}
                <View style={{ zIndex: 1 }}>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Location
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="e.g., Blaisdell Center"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={showLocation}
                    onChangeText={setShowLocation}
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>

                {/* Dancers Selection */}
                <View style={{ zIndex: 1 }}>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Select Dancers
                    </Text>
                    <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {selectedDancers.length} selected
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setShowDancerSelection(true)}
                    className={cn(
                      'px-4 py-3 rounded-xl flex-row items-center justify-between',
                      isDark ? 'bg-gray-800' : 'bg-gray-100'
                    )}
                  >
                    <View className="flex-row items-center">
                      <Users size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                        {selectedDancers.length > 0
                          ? `${selectedDancers.length} dancer${selectedDancers.length !== 1 ? 's' : ''} selected`
                          : 'Tap to select dancers'
                        }
                      </Text>
                    </View>
                    <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </Pressable>
                </View>

                {/* Description */}
                <View style={{ zIndex: 1 }}>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Description
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="Add details about this show..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={showDescription}
                    onChangeText={setShowDescription}
                    multiline
                    numberOfLines={4}
                    style={{ minHeight: 100, textAlignVertical: 'top' }}
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>
              </Pressable>
            </KeyboardAwareScrollView>
          </View>
        </Modal>

        {/* Dancer Selection Modal */}
        <Modal visible={showDancerSelection} animationType="slide" presentationStyle="pageSheet">
          <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => setShowDancerSelection(false)}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Select Dancers
              </Text>
              <Pressable onPress={() => setShowDancerSelection(false)}>
                <Check size={24} color="#8B5CF6" />
              </Pressable>
            </View>

            <View className="px-5 py-3 flex-row items-center justify-between">
              <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                {selectedDancers.length} of {members.length} selected
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => {
                    setSelectedDancers(members.map(m => m.id));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-500/20"
                >
                  <Text className="text-purple-600 text-sm font-medium">Select All</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setSelectedDancers([]);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className={cn('px-3 py-1.5 rounded-lg', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <Text className={cn('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Clear</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView className="flex-1 px-5">
              {members.map((member) => (
                <DancerItem key={member.id} member={member} />
              ))}
              {members.length === 0 && (
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
    </>
  );
}
