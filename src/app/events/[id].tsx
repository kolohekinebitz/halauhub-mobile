import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Calendar,
  Clock,
  MapPin,
  Edit3,
  Trash2,
  Check,
  X,
  ChevronDown,
  Users,
  UserPlus,
  UserMinus,
  Repeat,
  AlertCircle,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';
import type { Event, ClassLevel, RSVPStatus } from '@/lib/types';
import * as Haptics from 'expo-haptics';

// Common time options
const TIME_OPTIONS = [
  '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM',
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
  '9:00 PM', '9:30 PM', '10:00 PM',
];

// Default location options
const DEFAULT_LOCATIONS = [
  'Main Studio',
  'Community Center',
  'Beach Park',
  'School Gymnasium',
  'Cultural Center',
  'Outdoor Pavilion',
];

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [endTime, setEndTime] = useState('');
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [customLocation, setCustomLocation] = useState('');
  const [showPerformerPicker, setShowPerformerPicker] = useState(false);
  const [editParticipants, setEditParticipants] = useState<string[]>([]);

  // Recurring event edit/delete modals
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [showDeleteScopeModal, setShowDeleteScopeModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Store
  const events = useAppStore((s) => s.events);
  const updateEvent = useAppStore((s) => s.updateEvent);
  const deleteEvent = useAppStore((s) => s.deleteEvent);
  const deleteRecurringSeries = useAppStore((s) => s.deleteRecurringSeries);
  const updateRecurringSeries = useAppStore((s) => s.updateRecurringSeries);
  const isKumu = useAppStore((s) => s.isKumu);
  const getHalau = useAppStore((s) => s.getHalau);
  const getRSVPsByEvent = useAppStore((s) => s.getRSVPsByEvent);
  const updateRSVP = useAppStore((s) => s.updateRSVP);
  const getMemberRSVP = useAppStore((s) => s.getMemberRSVP);
  const currentMember = useAppStore((s) => s.currentMember);
  const getKeikiByGuardian = useAppStore((s) => s.getKeikiByGuardian);
  const members = useAppStore((s) => s.members);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  // Subscribe directly to rsvps slice so counts and selected state update immediately
  useAppStore((s) => s.rsvps);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  const event = events.find((e) => e.id === id);
  const halau = event ? getHalau(event.halauId) : null;
  const rsvps = event ? getRSVPsByEvent(event.id) : [];
  const goingCount = rsvps.filter((r) => r.status === 'going').length;
  const maybeCount = rsvps.filter((r) => r.status === 'maybe').length;
  const notGoingCount = rsvps.filter((r) => r.status === 'not_going').length;
  const isTeacher = isKumu();

  // Keiki helpers for RSVP
  const myKeiki = currentMember ? getKeikiByGuardian(currentMember.id) : [];
  const myKeikiIds = myKeiki.map((k) => k.id);

  // Check if current member is a participant in this event
  const isParticipant = event?.participantIds &&
    currentMember &&
    (event.participantIds.includes(currentMember.id) ||
     myKeikiIds.some((keikiId) => event.participantIds?.includes(keikiId)));

  // Get members for performer selection
  const halauMembers = event ? members.filter((m) =>
    m.halauId === event.halauId &&
    m.status === 'approved'
  ).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)) : [];

  const classLevels = event ? getClassLevelsForHalau(event.halauId) : [];
  const getClassLabel = (value?: string) => {
    if (!value) return null;
    return classLevels.find((l) => l.value === value)?.label || value;
  };

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState<Event['type']>('practice');

  // Initialize form when event loads
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setDate(parseISO(event.date));
      setStartTime(event.startTime);
      setEndTime(event.endTime || '');
      setLocation(event.location || '');
      setEventType(event.type);
      setEditParticipants(event.participantIds || []);
    }
  }, [event]);

  // If deleting, show a loading state while navigating away
  if (isDeleting || !event) {
    if (isDeleting) {
      return (
        <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
          <Text className={cn('text-lg', isDark ? 'text-white' : 'text-gray-900')}>
            Deleting event...
          </Text>
        </View>
      );
    }
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
        <Text className={cn('text-lg', isDark ? 'text-white' : 'text-gray-900')}>
          Event not found
        </Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-teal-600 font-medium">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Check if this is a recurring event
  const isRecurringEvent = event.isRecurring && event.recurringGroupId;

  // Get the updates object for saving
  const getUpdates = () => {
    const participantIds = editParticipants.length > 0
      ? editParticipants
      : undefined;

    return {
      title: title.trim(),
      description: description.trim() || undefined,
      date: format(date, 'yyyy-MM-dd'),
      startTime,
      endTime: endTime || undefined,
      location: location.trim() || undefined,
      type: eventType,
      participantIds,
    };
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Event title is required');
      return;
    }

    // If it's a recurring event, show the scope modal
    if (isRecurringEvent) {
      setShowEditScopeModal(true);
      return;
    }

    // For non-recurring events, just save normally
    updateEvent(event.id, getUpdates());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditing(false);
    Alert.alert('Success', 'Event updated successfully');
  };

  const handleSaveThisOnly = () => {
    // Save only this event instance
    updateEvent(event.id, getUpdates());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditScopeModal(false);
    setIsEditing(false);
    Alert.alert('Success', 'This event has been updated');
  };

  const handleSaveAllInSeries = () => {
    if (!event.recurringGroupId) return;
    // Save all events in the series (excluding date changes)
    updateRecurringSeries(event.recurringGroupId, getUpdates());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditScopeModal(false);
    setIsEditing(false);
    Alert.alert('Success', 'All events in the series have been updated');
  };

  const handleSaveThisAndFuture = () => {
    if (!event.recurringGroupId) return;
    // Save this event and all future events in the series
    updateRecurringSeries(event.recurringGroupId, getUpdates(), event.date);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditScopeModal(false);
    setIsEditing(false);
    Alert.alert('Success', 'This and future events have been updated');
  };

  const handleDelete = () => {
    // If it's a recurring event, show the scope modal
    if (isRecurringEvent) {
      setShowDeleteScopeModal(true);
      return;
    }

    // For non-recurring events, show simple confirmation
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setIsDeleting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            deleteEvent(event.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleDeleteThisOnly = () => {
    setIsDeleting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowDeleteScopeModal(false);
    deleteEvent(event.id);
    router.back();
  };

  const handleDeleteAllInSeries = () => {
    if (!event.recurringGroupId) return;
    setIsDeleting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowDeleteScopeModal(false);
    deleteRecurringSeries(event.recurringGroupId);
    router.back();
  };

  const handleDeleteThisAndFuture = () => {
    if (!event.recurringGroupId) return;
    setIsDeleting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowDeleteScopeModal(false);
    deleteRecurringSeries(event.recurringGroupId, event.date);
    router.back();
  };

  const handleCancel = () => {
    // Reset form to original values
    setTitle(event.title);
    setDescription(event.description || '');
    setDate(parseISO(event.date));
    setStartTime(event.startTime);
    setEndTime(event.endTime || '');
    setLocation(event.location || '');
    setEventType(event.type);
    setEditParticipants(event.participantIds || []);
    setShowPerformerPicker(false);
    setIsEditing(false);
  };

  const handleRSVP = (status: RSVPStatus) => {
    if (!event) return;
    updateRSVP(event.id, status);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleParticipant = (memberId: string) => {
    setEditParticipants((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleClassLevel = (level: ClassLevel | 'all') => {
    if (level === 'all') {
      // Toggle all members
      if (editParticipants.length === halauMembers.length) {
        setEditParticipants([]);
      } else {
        setEditParticipants(halauMembers.map((m) => m.id));
      }
    } else {
      // Toggle all members of this class level
      const membersOfLevel = halauMembers.filter((m) => m.classLevel === level);
      const allSelected = membersOfLevel.every((m) => editParticipants.includes(m.id));
      if (allSelected) {
        setEditParticipants((prev) => prev.filter((id) => !membersOfLevel.find((m) => m.id === id)));
      } else {
        const newIds = membersOfLevel.map((m) => m.id).filter((id) => !editParticipants.includes(id));
        setEditParticipants((prev) => [...prev, ...newIds]);
      }
    }
  };

  const getTypeColor = (type: Event['type']) => {
    switch (type) {
      case 'practice': return '#3B82F6';
      case 'performance': return '#8B5CF6';
      case 'meeting': return '#F59E0B';
      case 'workshop': return '#10B981';
      default: return '#6B7280';
    }
  };

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
            {isEditing ? 'Edit Event' : 'Event Details'}
          </Text>

          {isTeacher && !isEditing && (
            <Pressable
              onPress={() => setIsEditing(true)}
              className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
            >
              <Edit3 size={22} color="#0D9488" />
            </Pressable>
          )}

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
            >
              <Trash2 size={22} color="#EF4444" />
            </Pressable>
          )}

          {!isTeacher && <View className="w-10" />}
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: isEditing ? 200 : 40 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        <View className="px-5 py-6">
          {/* Event Type Badge */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)}>
            {isEditing ? (
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Event Type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['practice', 'performance', 'meeting', 'workshop', 'other'] as Event['type'][]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setEventType(type)}
                      className={cn(
                        'px-4 py-2 rounded-full',
                        eventType === type ? 'bg-teal-500' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium capitalize',
                          eventType === type ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                        )}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View className="flex-row items-center gap-2 mb-4">
                <View
                  className="self-start px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: getTypeColor(event.type) + '20' }}
                >
                  <Text
                    className="text-sm font-semibold capitalize"
                    style={{ color: getTypeColor(event.type) }}
                  >
                    {event.type}
                  </Text>
                </View>
                {isRecurringEvent && (
                  <View className={cn('flex-row items-center px-3 py-1.5 rounded-full', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <Repeat size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('text-sm font-medium ml-1.5 capitalize', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      {event.recurringPattern}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-6">
            {isEditing ? (
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Event Title *
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-lg font-semibold',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Event title"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>
            ) : (
              <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                {event.title}
              </Text>
            )}
          </Animated.View>

          {/* Date & Time Card */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mb-4">
            <View
              className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              {/* Date */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Date
                </Text>
                {isEditing ? (
                  <>
                    <Pressable
                      onPress={() => setShowDatePicker(true)}
                      className={cn('px-4 py-3 rounded-xl flex-row items-center', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                    >
                      <Calendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                        {format(date, 'EEEE, MMMM d, yyyy')}
                      </Text>
                    </Pressable>
                    {showDatePicker && (
                      <DateTimePicker
                        value={date}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(_, selectedDate) => {
                          setShowDatePicker(Platform.OS === 'ios');
                          if (selectedDate) setDate(selectedDate);
                        }}
                      />
                    )}
                  </>
                ) : (
                  <View className="flex-row items-center">
                    <Calendar size={20} color={halau?.primaryColor || '#0D9488'} />
                    <Text className={cn('ml-3 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {format(parseISO(event.date), 'EEEE, MMMM d, yyyy')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Time */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Time
                </Text>
                {isEditing ? (
                  <>
                    <Pressable
                      onPress={() => setShowTimePicker(!showTimePicker)}
                      className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                    >
                      <View className="flex-row items-center">
                        <Clock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                          {startTime}
                        </Text>
                      </View>
                      <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </Pressable>
                    {showTimePicker && (
                      <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          {TIME_OPTIONS.map((time) => (
                            <Pressable
                              key={time}
                              onPress={() => {
                                setStartTime(time);
                                setShowTimePicker(false);
                              }}
                              className={cn(
                                'px-4 py-3 border-b',
                                isDark ? 'border-gray-600' : 'border-gray-100',
                                startTime === time && (isDark ? 'bg-teal-500/20' : 'bg-teal-50')
                              )}
                            >
                              <Text
                                className={cn(
                                  'text-base',
                                  startTime === time
                                    ? 'text-teal-600 font-semibold'
                                    : isDark ? 'text-gray-300' : 'text-gray-700'
                                )}
                              >
                                {time}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                ) : (
                  <View className="flex-row items-center">
                    <Clock size={20} color={halau?.primaryColor || '#0D9488'} />
                    <Text className={cn('ml-3 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {event.startTime}
                    </Text>
                  </View>
                )}
              </View>

              {/* End Time */}
              <View className="mt-4 pt-4 border-t" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  End Time (optional)
                </Text>
                {isEditing ? (
                  <>
                    <Pressable
                      onPress={() => setShowEndTimePicker(!showEndTimePicker)}
                      className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                    >
                      <View className="flex-row items-center">
                        <Clock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        <Text className={cn('ml-3 text-base', endTime ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-500' : 'text-gray-400'))}>
                          {endTime || 'Select end time'}
                        </Text>
                      </View>
                      <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </Pressable>
                    {showEndTimePicker && (
                      <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          <Pressable
                            onPress={() => { setEndTime(''); setShowEndTimePicker(false); }}
                            className={cn('px-4 py-3 border-b', isDark ? 'border-gray-600' : 'border-gray-100')}
                          >
                            <Text className={cn('text-base italic', isDark ? 'text-gray-400' : 'text-gray-500')}>
                              No end time
                            </Text>
                          </Pressable>
                          {TIME_OPTIONS.map((time) => (
                            <Pressable
                              key={time}
                              onPress={() => { setEndTime(time); setShowEndTimePicker(false); }}
                              className={cn(
                                'px-4 py-3 border-b',
                                isDark ? 'border-gray-600' : 'border-gray-100',
                                endTime === time && (isDark ? 'bg-teal-500/20' : 'bg-teal-50')
                              )}
                            >
                              <Text className={cn(
                                'text-base',
                                endTime === time ? 'text-teal-600 font-semibold' : isDark ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {time}
                              </Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                ) : event.endTime ? (
                  <View className="flex-row items-center">
                    <Clock size={20} color={halau?.primaryColor || '#0D9488'} />
                    <Text className={cn('ml-3 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {event.endTime}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>

          {/* Location Card */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-4">
            <View
              className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Location
              </Text>
              {isEditing ? (
                <>
                  <Pressable
                    onPress={() => setShowLocationPicker(!showLocationPicker)}
                    className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                  >
                    <View className="flex-row items-center flex-1">
                      <MapPin size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      <Text
                        className={cn(
                          'ml-3 text-base flex-1',
                          location
                            ? (isDark ? 'text-white' : 'text-gray-900')
                            : (isDark ? 'text-gray-500' : 'text-gray-400')
                        )}
                        numberOfLines={1}
                      >
                        {location || 'Select a location'}
                      </Text>
                    </View>
                    <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </Pressable>
                  {showLocationPicker && (
                    <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}>
                      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                        {DEFAULT_LOCATIONS.map((loc) => (
                          <Pressable
                            key={loc}
                            onPress={() => {
                              setLocation(loc);
                              setShowLocationPicker(false);
                            }}
                            className={cn(
                              'px-4 py-3 border-b',
                              isDark ? 'border-gray-600' : 'border-gray-100',
                              location === loc && (isDark ? 'bg-teal-500/20' : 'bg-teal-50')
                            )}
                          >
                            <Text
                              className={cn(
                                'text-base',
                                location === loc
                                  ? 'text-teal-600 font-semibold'
                                  : isDark ? 'text-gray-300' : 'text-gray-700'
                              )}
                            >
                              {loc}
                            </Text>
                          </Pressable>
                        ))}
                        {/* Custom location option */}
                        <View className={cn('px-4 py-3', isDark ? 'border-gray-600' : 'border-gray-100')}>
                          <Text className={cn('text-xs font-medium mb-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            Or enter custom location:
                          </Text>
                          <View className="flex-row items-center gap-2">
                            <TextInput
                              className={cn(
                                'flex-1 px-3 py-2 rounded-lg text-sm',
                                isDark ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-900'
                              )}
                              placeholder="Custom location..."
                              placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
                              value={customLocation}
                              onChangeText={setCustomLocation}
                              cursorColor={isDark ? '#FFFFFF' : '#000000'}
                              selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                            />
                            <Pressable
                              onPress={() => {
                                if (customLocation.trim()) {
                                  setLocation(customLocation.trim());
                                  setCustomLocation('');
                                  setShowLocationPicker(false);
                                }
                              }}
                              disabled={!customLocation.trim()}
                              className={cn(
                                'px-3 py-2 rounded-lg',
                                customLocation.trim() ? 'bg-teal-500' : (isDark ? 'bg-gray-600' : 'bg-gray-200')
                              )}
                            >
                              <Text className={cn('font-medium', customLocation.trim() ? 'text-white' : (isDark ? 'text-gray-500' : 'text-gray-400'))}>
                                Add
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </>
              ) : (
                <View className="flex-row items-center">
                  <MapPin size={20} color={halau?.primaryColor || '#0D9488'} />
                  <Text className={cn('ml-3 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    {event.location || 'No location set'}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)} className="mb-4">
            <View
              className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Description
              </Text>
              {isEditing ? (
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add event description..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              ) : (
                <Text className={cn('text-base', isDark ? 'text-gray-300' : 'text-gray-700')}>
                  {event.description || 'No description'}
                </Text>
              )}
            </View>
          </Animated.View>

          {/* Attendee/Performer Management (Edit Mode - All Event Types) */}
          {isEditing && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-4">
              <View
                className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {eventType === 'performance' ? 'Performers' : 'Attendees'}
                  </Text>
                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    {editParticipants.length} selected
                  </Text>
                </View>

                {/* Class Level Quick Select */}
                <View className="mb-3">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                    <View className="flex-row gap-2">
                      {[
                        { label: 'All Members', value: 'all' as const },
                        { label: 'Advanced', value: 'advanced' as ClassLevel },
                        { label: 'Intermediate', value: 'intermediate' as ClassLevel },
                        { label: 'Beginner', value: 'beginner' as ClassLevel },
                        { label: 'Minors', value: 'minor' as ClassLevel },
                      ].map((option) => {
                        const isAllSelected = option.value === 'all'
                          ? editParticipants.length === halauMembers.length && halauMembers.length > 0
                          : halauMembers.filter((m) => m.classLevel === option.value).every((m) => editParticipants.includes(m.id)) &&
                            halauMembers.filter((m) => m.classLevel === option.value).length > 0;
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => toggleClassLevel(option.value)}
                            className={cn(
                              'px-3 py-2 rounded-lg',
                              isAllSelected
                                ? eventType === 'performance' ? 'bg-purple-500' : 'bg-teal-500'
                                : isDark ? 'bg-gray-700' : 'bg-gray-100'
                            )}
                          >
                            <Text className={cn(
                              'text-sm font-medium',
                              isAllSelected ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                            )}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>

                {/* Toggle Member List */}
                <Pressable
                  onPress={() => setShowPerformerPicker(!showPerformerPicker)}
                  className={cn(
                    'px-4 py-3 rounded-xl flex-row items-center justify-between',
                    isDark ? 'bg-gray-700' : 'bg-gray-100'
                  )}
                >
                  <View className="flex-row items-center">
                    <Users size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      {editParticipants.length > 0
                        ? `${editParticipants.length} ${eventType === 'performance' ? 'performer' : 'attendee'}${editParticipants.length > 1 ? 's' : ''} selected`
                        : `Select ${eventType === 'performance' ? 'performers' : 'attendees'}`}
                    </Text>
                  </View>
                  <ChevronDown
                    size={20}
                    color={isDark ? '#9CA3AF' : '#6B7280'}
                    style={{ transform: [{ rotate: showPerformerPicker ? '180deg' : '0deg' }] }}
                  />
                </Pressable>

                {/* Member Selection List */}
                {showPerformerPicker && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200')}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {halauMembers.map((member) => {
                        const isSelected = editParticipants.includes(member.id);
                        const accentColor = eventType === 'performance' ? '#8B5CF6' : '#0D9488';
                        return (
                          <Pressable
                            key={member.id}
                            onPress={() => toggleParticipant(member.id)}
                            className={cn(
                              'px-4 py-3 border-b flex-row items-center justify-between',
                              isDark ? 'border-gray-600' : 'border-gray-100',
                              isSelected && (eventType === 'performance'
                                ? (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                : (isDark ? 'bg-teal-500/20' : 'bg-teal-50'))
                            )}
                          >
                            <View className="flex-row items-center flex-1">
                              <Text className={cn(
                                'text-base',
                                isSelected
                                  ? eventType === 'performance' ? 'text-purple-600 font-semibold' : 'text-teal-600 font-semibold'
                                  : isDark ? 'text-gray-300' : 'text-gray-700'
                              )}>
                                {member.firstName} {member.lastName}
                              </Text>
                              {member.classLevel && (
                                <View className={cn(
                                  'ml-2 px-2 py-0.5 rounded-full',
                                  'bg-purple-500/20'
                                )}>
                                  <Text className="text-xs capitalize text-purple-600">
                                    {getClassLabel(member.classLevel)}
                                  </Text>
                                </View>
                              )}
                            </View>
                            {isSelected && <Check size={18} color={accentColor} />}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            </Animated.View>
          )}

          {/* RSVP Section for Participants (View Mode - All Event Types) */}
          {!isEditing && isParticipant && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-4">
              <View
                className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : event.type === 'performance' ? 'bg-purple-50' : 'bg-teal-50')}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <Text className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                  Your Response
                </Text>
                {(() => {
                  const myRsvp = currentMember ? getMemberRSVP(event.id, currentMember.id) : undefined;
                  return (
                    <View className="flex-row gap-3">
                      <Pressable
                        onPress={() => handleRSVP('going')}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl items-center',
                          myRsvp?.status === 'going'
                            ? 'bg-green-500'
                            : isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                        )}
                        style={myRsvp?.status === 'going' ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: isDark ? 0.4 : 0.1,
                          shadowRadius: 8,
                          elevation: 6,
                        } : undefined}
                      >
                        <Text className={cn(
                          'font-semibold text-sm',
                          myRsvp?.status === 'going' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Going
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRSVP('maybe')}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl items-center',
                          myRsvp?.status === 'maybe'
                            ? 'bg-amber-500'
                            : isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                        )}
                        style={myRsvp?.status === 'maybe' ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: isDark ? 0.4 : 0.1,
                          shadowRadius: 8,
                          elevation: 6,
                        } : undefined}
                      >
                        <Text className={cn(
                          'font-semibold text-sm',
                          myRsvp?.status === 'maybe' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Maybe
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRSVP('not_going')}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl items-center',
                          myRsvp?.status === 'not_going'
                            ? 'bg-red-500'
                            : isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                        )}
                        style={myRsvp?.status === 'not_going' ? {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: isDark ? 0.4 : 0.1,
                          shadowRadius: 8,
                          elevation: 6,
                        } : undefined}
                      >
                        <Text className={cn(
                          'font-semibold text-sm',
                          myRsvp?.status === 'not_going' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Can't Go
                        </Text>
                      </Pressable>
                    </View>
                  );
                })()}
              </View>
            </Animated.View>
          )}

          {/* Attendee Response Summary (View Mode - Kumu/Admin - All Event Types) */}
          {!isEditing && isTeacher && event.participantIds && event.participantIds.length > 0 && (
            <Animated.View entering={FadeInDown.delay(350).duration(400)} className="mb-4">
              <View
                className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <Text className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                  {event.type === 'performance' ? 'Performer' : 'Attendee'} Responses
                </Text>
                {(() => {
                  const pendingCount = (event.participantIds?.length || 0) - rsvps.length;
                  return (
                    <View className="flex-row gap-3">
                      <View className="flex-1 items-center">
                        <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mb-1">
                          <Text className="text-green-600 font-bold">{goingCount}</Text>
                        </View>
                        <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Going</Text>
                      </View>
                      <View className="flex-1 items-center">
                        <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center mb-1">
                          <Text className="text-amber-600 font-bold">{maybeCount}</Text>
                        </View>
                        <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Maybe</Text>
                      </View>
                      <View className="flex-1 items-center">
                        <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center mb-1">
                          <Text className="text-red-600 font-bold">{notGoingCount}</Text>
                        </View>
                        <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Can't Go</Text>
                      </View>
                      <View className="flex-1 items-center">
                        <View className={cn('w-10 h-10 rounded-full items-center justify-center mb-1', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                          <Text className={isDark ? 'text-gray-400' : 'text-gray-500'}>{pendingCount}</Text>
                        </View>
                        <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Pending</Text>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </Animated.View>
          )}

          {/* Attendees Count Badge (View Mode - Non-Teacher) */}
          {!isEditing && event.participantIds && event.participantIds.length > 0 && !isTeacher && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-4">
              <View
                className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: event.type === 'performance' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(13, 148, 136, 0.2)' }}
                  >
                    <Users size={20} color={event.type === 'performance' ? '#8B5CF6' : '#0D9488'} />
                  </View>
                  <View>
                    <Text className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      {event.participantIds.length} {event.type === 'performance' ? 'Performer' : 'Attendee'}{event.participantIds.length > 1 ? 's' : ''}
                    </Text>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      Selected for this {event.type}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* General RSVP Summary (view only - non-performance events) */}
          {!isEditing && event.type !== 'performance' && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View
                className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-white')}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isDark ? 0.5 : 0.2,
                  shadowRadius: 6,
                  elevation: isDark ? 6 : 5,
                }}
              >
                <Text className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Responses
                </Text>
                <View className="flex-row gap-4">
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-teal-500/20 items-center justify-center mr-2">
                      <Users size={16} color="#0D9488" />
                    </View>
                    <View>
                      <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        {goingCount}
                      </Text>
                      <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Going</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <View className="w-8 h-8 rounded-full bg-amber-500/20 items-center justify-center mr-2">
                      <Users size={16} color="#F59E0B" />
                    </View>
                    <View>
                      <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                        {maybeCount}
                      </Text>
                      <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Maybe</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Fixed Bottom Buttons (Edit Mode) */}
      {isEditing && (
        <View
          className={cn('px-5 py-4 border-t', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200')}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleCancel}
              className={cn(
                'flex-1 py-4 rounded-xl items-center flex-row justify-center',
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
              <X size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text className={cn('ml-2 font-semibold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              className="flex-1 py-4 rounded-xl bg-teal-500 items-center flex-row justify-center active:opacity-80"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.5 : 0.18,
                shadowRadius: 12,
                elevation: 10,
              }}
            >
              <Check size={20} color="white" />
              <Text className="ml-2 text-white font-semibold">Save Changes</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Edit Scope Overlay for Recurring Events - No Modal to prevent iOS freeze */}
      {showEditScopeModal && (
        <>
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => setShowEditScopeModal(false)}
            style={{ zIndex: 10 }}
          />
          <View
            className={cn('absolute bottom-0 left-0 right-0 rounded-t-3xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
            style={{ paddingBottom: insets.bottom + 24, zIndex: 11 }}
          >
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-teal-500/20 items-center justify-center mb-3">
                <Repeat size={24} color="#0D9488" />
              </View>
              <Text className={cn('text-xl font-bold text-center', isDark ? 'text-white' : 'text-gray-900')}>
                Edit Recurring Event
              </Text>
              <Text className={cn('text-sm text-center mt-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                This event repeats {event.recurringPattern}. How would you like to apply your changes?
              </Text>
            </View>

            <View className="gap-3 mt-4">
              <Pressable
                onPress={handleSaveThisOnly}
                className={cn(
                  'py-4 px-4 rounded-xl border',
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}
              >
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  This Event Only
                </Text>
                <Text className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Only update this single occurrence
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSaveThisAndFuture}
                className={cn(
                  'py-4 px-4 rounded-xl border',
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}
              >
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  This & Future Events
                </Text>
                <Text className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Update this and all following events in the series
                </Text>
              </Pressable>

              <Pressable
                onPress={handleSaveAllInSeries}
                className="py-4 px-4 rounded-xl bg-teal-500"
              >
                <Text className="font-semibold text-white">
                  All Events in Series
                </Text>
                <Text className="text-sm mt-1 text-teal-100">
                  Update all events in this recurring series
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowEditScopeModal(false)}
                className={cn(
                  'py-4 rounded-xl items-center mt-2',
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                )}
              >
                <Text className={cn('font-semibold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* Delete Scope Overlay for Recurring Events - No Modal to prevent iOS freeze */}
      {showDeleteScopeModal && (
        <>
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => setShowDeleteScopeModal(false)}
            style={{ zIndex: 10 }}
          />
          <View
            className={cn('absolute bottom-0 left-0 right-0 rounded-t-3xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
            style={{ paddingBottom: insets.bottom + 24, zIndex: 11 }}
          >
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-red-500/20 items-center justify-center mb-3">
                <AlertCircle size={24} color="#EF4444" />
              </View>
              <Text className={cn('text-xl font-bold text-center', isDark ? 'text-white' : 'text-gray-900')}>
                Delete Recurring Event
              </Text>
              <Text className={cn('text-sm text-center mt-2', isDark ? 'text-gray-400' : 'text-gray-500')}>
                This event repeats {event.recurringPattern}. What would you like to delete?
              </Text>
            </View>

            <View className="gap-3 mt-4">
              <Pressable
                onPress={handleDeleteThisOnly}
                className={cn(
                  'py-4 px-4 rounded-xl border',
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                )}
              >
                <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  This Event Only
                </Text>
                <Text className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Only delete this single occurrence
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteThisAndFuture}
                className={cn(
                  'py-4 px-4 rounded-xl border border-red-200',
                  isDark ? 'bg-red-500/10' : 'bg-red-50'
                )}
              >
                <Text className="font-semibold text-red-600">
                  This & Future Events
                </Text>
                <Text className={cn('text-sm mt-1', isDark ? 'text-red-400' : 'text-red-500')}>
                  Delete this and all following events in the series
                </Text>
              </Pressable>

              <Pressable
                onPress={handleDeleteAllInSeries}
                className="py-4 px-4 rounded-xl bg-red-500"
              >
                <Text className="font-semibold text-white">
                  Delete Entire Series
                </Text>
                <Text className="text-sm mt-1 text-red-100">
                  Remove all events in this recurring series
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowDeleteScopeModal(false)}
                className={cn(
                  'py-4 rounded-xl items-center mt-2',
                  isDark ? 'bg-gray-800' : 'bg-gray-100'
                )}
              >
                <Text className={cn('font-semibold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
