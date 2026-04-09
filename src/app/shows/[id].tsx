import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Users,
  Star,
  Clock,
  Trash2,
  Edit3,
  X,
  Check,
  ChevronDown,
  UserCheck,
  Save,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import type { Member } from '@/lib/types';
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

export default function ShowDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Store selectors
  const shows = useAppStore((s) => s.shows);
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const getShowParticipants = useAppStore((s) => s.getShowParticipants);
  const getMembersByHalau = useAppStore((s) => s.getMembersByHalau);
  const getMember = useAppStore((s) => s.getMember);
  const updateShow = useAppStore((s) => s.updateShow);
  const deleteShow = useAppStore((s) => s.deleteShow);
  const addShowParticipant = useAppStore((s) => s.addShowParticipant);
  const removeShowParticipant = useAppStore((s) => s.removeShowParticipant);
  const isKumu = useAppStore((s) => s.isKumu);

  const show = shows.find((s) => s.id === id);
  const participants = id ? getShowParticipants(id) : [];
  const members = currentHalauId ? getMembersByHalau(currentHalauId) : [];
  const isTeacher = isKumu();

  // Check if current user is a participant
  const isParticipant = currentMember
    ? participants.some((p) => p.memberId === currentMember.id)
    : false;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [editStartTime, setEditStartTime] = useState('6:00 PM');
  const [editEndTime, setEditEndTime] = useState('9:00 PM');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selectedDancers, setSelectedDancers] = useState<string[]>([]);

  // Picker states
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showDancerSelection, setShowDancerSelection] = useState(false);

  // Initialize edit form when show loads or editing starts
  useEffect(() => {
    if (show && isEditing) {
      setEditName(show.name);
      const date = parseISO(show.date);
      setEditDate(date);
      setSelectedDay(date.getDate());
      setSelectedMonth(date.getMonth());
      setSelectedYear(date.getFullYear());
      setEditStartTime(show.startTime || '6:00 PM');
      setEditEndTime(show.endTime || '9:00 PM');
      setEditLocation(show.location || '');
      setEditDescription(show.description || '');
      setSelectedDancers(participants.map((p) => p.memberId));
    }
  }, [show, isEditing]);

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
        ? prev.filter((pid) => pid !== memberId)
        : [...prev, memberId]
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    if (!show || !editName.trim()) return;

    // Update show details
    updateShow(show.id, {
      name: editName.trim(),
      date: format(editDate, 'yyyy-MM-dd'),
      startTime: editStartTime,
      endTime: editEndTime || undefined,
      location: editLocation.trim(),
      description: editDescription.trim() || undefined,
    });

    // Update participants
    const currentParticipantIds = participants.map((p) => p.memberId);

    // Remove participants that were deselected
    currentParticipantIds.forEach((memberId) => {
      if (!selectedDancers.includes(memberId)) {
        removeShowParticipant(show.id, memberId);
      }
    });

    // Add new participants
    selectedDancers.forEach((memberId) => {
      if (!currentParticipantIds.includes(memberId)) {
        addShowParticipant(show.id, memberId);
      }
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Show',
      'Are you sure you want to delete this show? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (id) {
              deleteShow(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            }
          },
        },
      ]
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

  if (!show) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Show Not Found',
            headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
            headerTintColor: isDark ? '#FFFFFF' : '#111827',
          }}
        />
        <View className={cn('flex-1 items-center justify-center p-5', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
          <Star size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
          <Text className={cn('mt-4 text-lg font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Show not found
          </Text>
          <BackButton />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: show.name,
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
          headerRight: () =>
            isTeacher ? (
              <View className="flex-row items-center gap-2">
                {isEditing ? (
                  <>
                    <Pressable onPress={() => setIsEditing(false)} className="p-2">
                      <X size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </Pressable>
                    <Pressable onPress={handleSave} className="p-2">
                      <Save size={22} color="#8B5CF6" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => setIsEditing(true)} className="p-2">
                      <Edit3 size={22} color="#8B5CF6" />
                    </Pressable>
                    <Pressable onPress={handleDelete} className="p-2">
                      <Trash2 size={22} color="#EF4444" />
                    </Pressable>
                  </>
                )}
              </View>
            ) : null,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
        >
          {/* Header Card */}
          <Animated.View entering={FadeInDown.duration(400)} className="px-5 pt-4">
            <View
              className={cn('rounded-2xl p-5', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.3 : 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-start">
                <View className="w-16 h-16 rounded-2xl bg-purple-500/10 items-center justify-center mr-4">
                  <Star size={32} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  {isEditing ? (
                    <TextInput
                      className={cn(
                        'text-xl font-bold px-3 py-2 rounded-lg mb-2',
                        isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Show name"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                  ) : (
                    <Text className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                      {show.name}
                    </Text>
                  )}
                  {isParticipant && (
                    <View className="flex-row items-center mt-2">
                      <View className="px-2.5 py-1 rounded-full bg-purple-500/20">
                        <Text className="text-xs font-semibold text-purple-600">You're performing</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Details Section */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="px-5 pt-4">
            <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
              Details
            </Text>
            <View
              className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.2 : 0.03,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              {isEditing ? (
                <Pressable onPress={closeAllPickers} className="gap-4">
                  {/* Date Section */}
                  <View style={{ zIndex: 100 }}>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Date
                    </Text>
                    <View className="flex-row gap-2">
                      {/* Month */}
                      <View className="flex-1" style={{ zIndex: 103 }}>
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
                          <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                            {MONTHS[selectedMonth].substring(0, 3)}
                          </Text>
                          <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                        {showMonthPicker && (
                          <View
                            className={cn('absolute top-12 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
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
                                    setEditDate(newDate);
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

                      {/* Day */}
                      <View className="flex-1" style={{ zIndex: 102 }}>
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
                            className={cn('absolute top-12 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
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
                                      setEditDate(newDate);
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

                      {/* Year */}
                      <View className="flex-1" style={{ zIndex: 101 }}>
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
                            className={cn('absolute top-12 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
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
                                    setEditDate(newDate);
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
                          <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                            {editStartTime}
                          </Text>
                          <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                        {showStartTimePicker && (
                          <View
                            className={cn('absolute top-12 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                            style={{ zIndex: 1000, elevation: 1000 }}
                          >
                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                              {TIME_OPTIONS.map((time) => (
                                <Pressable
                                  key={time}
                                  onPress={() => {
                                    setEditStartTime(time);
                                    setShowStartTimePicker(false);
                                  }}
                                  className={cn(
                                    'px-3 py-2 border-b',
                                    isDark ? 'border-gray-600' : 'border-gray-100',
                                    editStartTime === time && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                  )}
                                >
                                  <Text className={cn('text-sm', editStartTime === time ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
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
                          <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                            {editEndTime}
                          </Text>
                          <ChevronDown size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                        {showEndTimePicker && (
                          <View
                            className={cn('absolute top-12 left-0 right-0 rounded-lg overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}
                            style={{ zIndex: 1000, elevation: 1000 }}
                          >
                            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                              {TIME_OPTIONS.map((time) => (
                                <Pressable
                                  key={time}
                                  onPress={() => {
                                    setEditEndTime(time);
                                    setShowEndTimePicker(false);
                                  }}
                                  className={cn(
                                    'px-3 py-2 border-b',
                                    isDark ? 'border-gray-600' : 'border-gray-100',
                                    editEndTime === time && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                  )}
                                >
                                  <Text className={cn('text-sm', editEndTime === time ? 'text-purple-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700')}>
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
                        isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      value={editLocation}
                      onChangeText={setEditLocation}
                      placeholder="Enter location"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                  </View>

                  {/* Description */}
                  <View style={{ zIndex: 1 }}>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Description
                    </Text>
                    <TextInput
                      className={cn(
                        'px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      value={editDescription}
                      onChangeText={setEditDescription}
                      placeholder="Enter description"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      multiline
                      numberOfLines={3}
                      style={{ minHeight: 80, textAlignVertical: 'top' }}
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                  </View>
                </Pressable>
              ) : (
                <View className="gap-4">
                  {/* Date */}
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-purple-500/10 items-center justify-center mr-3">
                      <Calendar size={20} color="#8B5CF6" />
                    </View>
                    <View>
                      <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Date</Text>
                      <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {format(parseISO(show.date), 'EEEE, MMMM d, yyyy')}
                      </Text>
                    </View>
                  </View>

                  {/* Time */}
                  {show.startTime && (
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-purple-500/10 items-center justify-center mr-3">
                        <Clock size={20} color="#8B5CF6" />
                      </View>
                      <View>
                        <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Time</Text>
                        <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                          {show.startTime}{show.endTime ? ` - ${show.endTime}` : ''}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Location */}
                  {show.location && (
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-xl bg-purple-500/10 items-center justify-center mr-3">
                        <MapPin size={20} color="#8B5CF6" />
                      </View>
                      <View>
                        <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>Location</Text>
                        <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                          {show.location}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Description */}
                  {show.description && (
                    <View className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <Text className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                        {show.description}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Performers Section */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="px-5 pt-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Performers ({participants.length})
              </Text>
              {isEditing && (
                <Pressable
                  onPress={() => setShowDancerSelection(true)}
                  className="px-3 py-1.5 rounded-lg bg-purple-500/20"
                >
                  <Text className="text-purple-600 text-sm font-medium">Edit</Text>
                </Pressable>
              )}
            </View>
            <View
              className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.2 : 0.03,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              {participants.length > 0 ? (
                <View className="gap-2">
                  {participants.map((participation) => {
                    const member = getMember(participation.memberId);
                    if (!member) return null;
                    return (
                      <View
                        key={participation.id}
                        className="flex-row items-center py-2"
                      >
                        <View
                          className={cn(
                            'w-10 h-10 rounded-full items-center justify-center mr-3',
                            isDark ? 'bg-gray-700' : 'bg-gray-200'
                          )}
                        >
                          <Text className={cn('text-lg font-bold', isDark ? 'text-gray-400' : 'text-gray-600')}>
                            {member.firstName.charAt(0)}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            {member.firstName} {member.lastName}
                          </Text>
                          <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {member.role === 'teacher' ? 'Teacher' : 'Student'}
                          </Text>
                        </View>
                        {currentMember?.id === member.id && (
                          <View className="px-2 py-1 rounded bg-purple-500/20">
                            <Text className="text-xs text-purple-600 font-medium">You</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View className="py-4 items-center">
                  <Users size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  <Text className={cn('mt-2 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    No performers assigned yet
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </KeyboardAwareScrollView>
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
