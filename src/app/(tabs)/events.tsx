import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore, useShallow } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Calendar as CalendarIcon, MapPin, Clock, Plus, X, ChevronLeft, ChevronRight, Check, Users, ChevronDown, Repeat, Trash2, Filter, Archive, List, FileText } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import type { Event, RSVPStatus, Show } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { useDeepMemo } from '@/lib/useDeepMemo';
import { ErrorBoundary } from '@/components/ErrorBoundary';

type ViewMode = 'calendar' | 'list' | 'archive';
type EventFilter = 'all' | 'my_events' | 'practice' | 'performance' | 'meeting' | 'workshop' | 'other';

// Common time options
const TIME_OPTIONS = [
  '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM',
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
  '9:00 PM', '9:30 PM', '10:00 PM',
];

// Generate arrays for date picker
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear + i);

function DropdownPicker({
  items,
  selectedValue,
  onSelect,
  isVisible,
  onClose,
  formatItem = (item: number | string) => String(item),
  isDark,
}: {
  items: (number | string)[];
  selectedValue: number | string;
  onSelect: (value: number | string) => void;
  isVisible: boolean;
  onClose: () => void;
  formatItem?: (item: number | string) => string;
  isDark: boolean;
}) {
  if (!isVisible) return null;
  return (
    <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
      <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
        {items.map((item, index) => (
          <Pressable
            key={index}
            onPress={() => { onSelect(item); onClose(); }}
            className={cn(
              'px-4 py-3 border-b',
              isDark ? 'border-gray-700' : 'border-gray-100',
              selectedValue === item && (isDark ? 'bg-gray-700' : 'bg-gray-100')
            )}
          >
            <Text
              className={cn(
                'text-base text-center',
                selectedValue === item ? 'font-semibold' : isDark ? 'text-white' : 'text-gray-700'
              )}
            >
              {formatItem(item)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function EventsContent() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { action } = useLocalSearchParams<{ action?: string }>();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [showPastEvents, setShowPastEvents] = useState<boolean>(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditScopeModal, setShowEditScopeModal] = useState(false);
  const [editScope, setEditScope] = useState<'single' | 'future'>('single');
  const editScrollRef = useRef<any>(null);
  const descriptionFieldRef = useRef<any>(null);

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDay, setEditDay] = useState(1);
  const [editMonth, setEditMonth] = useState(0);
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [editStartTime, setEditStartTime] = useState('10:00 AM');
  const [editEndTime, setEditEndTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editType, setEditType] = useState<Event['type']>('practice');
  const [editParticipants, setEditParticipants] = useState<string[]>([]);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editDatePickerMonth, setEditDatePickerMonth] = useState(new Date()); // For calendar view in edit date picker
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [showEditEndTimePicker, setShowEditEndTimePicker] = useState(false);
  const [showEditLocationPicker, setShowEditLocationPicker] = useState(false);
  const [showEditParticipantPicker, setShowEditParticipantPicker] = useState(false);
  const [editCustomLocation, setEditCustomLocation] = useState('');

  // Edit recurring event state
  const [editIsRecurring, setEditIsRecurring] = useState(false);
  const [editRecurringPattern, setEditRecurringPattern] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [editRecurringEndDay, setEditRecurringEndDay] = useState(new Date().getDate());
  const [editRecurringEndMonth, setEditRecurringEndMonth] = useState(new Date().getMonth() + 3 > 11 ? (new Date().getMonth() + 3) % 12 : new Date().getMonth() + 3);
  const [editRecurringEndYear, setEditRecurringEndYear] = useState(new Date().getMonth() + 3 > 11 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  const [showEditRecurringEndDayPicker, setShowEditRecurringEndDayPicker] = useState(false);
  const [showEditRecurringEndMonthPicker, setShowEditRecurringEndMonthPicker] = useState(false);
  const [showEditRecurringEndYearPicker, setShowEditRecurringEndYearPicker] = useState(false);

  // Open add modal if action=add is passed
  useEffect(() => {
    if (action === 'add') {
      setShowAddModal(true);
    }
  }, [action]);

  // Form state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [eventStartTime, setEventStartTime] = useState('10:00 AM');
  const [eventEndTime, setEventEndTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventType, setEventType] = useState<Event['type']>('practice');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date()); // For calendar view in date picker
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndTimePicker2, setShowEndTimePicker2] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [customLocation, setCustomLocation] = useState('');

  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [recurringEndDay, setRecurringEndDay] = useState(new Date().getDate());
  const [recurringEndMonth, setRecurringEndMonth] = useState(new Date().getMonth() + 3 > 11 ? (new Date().getMonth() + 3) % 12 : new Date().getMonth() + 3);
  const [recurringEndYear, setRecurringEndYear] = useState(new Date().getMonth() + 3 > 11 ? new Date().getFullYear() + 1 : new Date().getFullYear());
  const [showRecurringEndDayPicker, setShowRecurringEndDayPicker] = useState(false);
  const [showRecurringEndMonthPicker, setShowRecurringEndMonthPicker] = useState(false);
  const [showRecurringEndYearPicker, setShowRecurringEndYearPicker] = useState(false);

  // Performance participant state
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);

  // Store selectors - primitives selected individually
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useDeepMemo(useAppStore((s) => s.currentMember));

  // Subscribe directly to state arrays for real-time updates
  const storeEvents = useAppStore((s) => s.events);
  const storeShows = useAppStore((s) => s.shows);
  const storeMembers = useAppStore((s) => s.members);
  const storeRsvps = useAppStore((s) => s.rsvps); // Subscribe to RSVPs for real-time updates
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  // Store actions - use useShallow to prevent re-renders
  const storeActions = useAppStore(useShallow((s) => ({
    getEventsByHalau: s.getEventsByHalau,
    getShowsByHalau: s.getShowsByHalau,
    getMembersByHalau: s.getMembersByHalau,
    createEvent: s.createEvent,
    createRecurringEvents: s.createRecurringEvents,
    updateEvent: s.updateEvent,
    updateRecurringSeries: s.updateRecurringSeries,
    deleteEvent: s.deleteEvent,
    deleteRecurringSeries: s.deleteRecurringSeries,
    cancelEvent: s.cancelEvent,
    updateRSVP: s.updateRSVP,
    getMemberRSVP: s.getMemberRSVP,
    getRSVPsByEvent: s.getRSVPsByEvent,
    isKumu: s.isKumu,
    getHalau: s.getHalau,
    getKeikiByGuardian: s.getKeikiByGuardian,
    getClassLevelsForHalau: s.getClassLevelsForHalau,
  })));

  const {
    getEventsByHalau,
    getShowsByHalau,
    getMembersByHalau,
    createEvent,
    createRecurringEvents,
    updateEvent,
    updateRecurringSeries,
    deleteEvent,
    deleteRecurringSeries,
    cancelEvent,
    updateRSVP,
    getMemberRSVP,
    getRSVPsByEvent,
    isKumu,
    getHalau,
    getKeikiByGuardian,
    getClassLevelsForHalau,
  } = storeActions;

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Derive data from subscribed state arrays for real-time updates
  const allEvents = useMemo(() => {
    if (!currentHalauId) return [];
    return storeEvents.filter((e) => e.halauId === currentHalauId && !e.isCancelled);
  }, [currentHalauId, storeEvents]);

  const shows = useMemo(() => {
    if (!currentHalauId) return [];
    return storeShows.filter((s) => s.halauId === currentHalauId);
  }, [currentHalauId, storeShows]);

  const members = useMemo(() => {
    if (!currentHalauId) return [];
    return storeMembers.filter((m) => m.halauId === currentHalauId && m.status === 'approved');
  }, [currentHalauId, storeMembers]);
  const isTeacher = isKumu();
  const myKeiki = useMemo(() => currentMember ? getKeikiByGuardian(currentMember.id) : [], [currentMember, getKeikiByGuardian]);
  const myKeikiIds = useMemo(() => myKeiki.map((k) => k.id), [myKeiki]);

  // Reactive RSVP helpers that use subscribed state for real-time updates
  const getMyRsvp = useCallback((eventId: string) => {
    if (!currentMember) return undefined;
    return storeRsvps.find((r) => r.eventId === eventId && r.memberId === currentMember.id);
  }, [storeRsvps, currentMember]);

  const getEventRsvps = useCallback((eventId: string) => {
    return storeRsvps.filter((r) => r.eventId === eventId);
  }, [storeRsvps]);

  // Get theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Get class levels including custom ones
  const classLevels = useMemo(() => currentHalauId ? getClassLevelsForHalau(currentHalauId) : [], [currentHalauId, getClassLevelsForHalau, halaus]);
  const getClassLabel = (value?: string) => {
    if (!value) return null;
    return classLevels.find((l) => l.value === value)?.label || value;
  };

  // Filter events based on participant assignments
  // Teachers/admins see all events by default but can filter
  // Students/guardians only see events they or their keiki are explicitly assigned to
  const events = useMemo(() => {
    // First apply visibility filter (for non-teachers)
    let filteredEvents = allEvents.filter((e) => {
      // Kumu/Admin sees all events
      if (isTeacher) return true;
      // Students/parents must be explicitly assigned to see an event
      // If no participants specified, students/parents don't see it
      if (!e.participantIds || e.participantIds.length === 0) return false;
      // Show if current member is a participant
      if (currentMember && e.participantIds.includes(currentMember.id)) return true;
      // Show if any of the current member's keiki is a participant
      if (myKeikiIds.some((keikiId) => e.participantIds?.includes(keikiId))) return true;
      return false;
    });

    // Then apply teacher/admin filter if applicable
    if (isTeacher && eventFilter !== 'all') {
      if (eventFilter === 'my_events') {
        // Filter to events created by the current member
        filteredEvents = filteredEvents.filter((e) => e.createdBy === currentMember?.id);
      } else {
        // Filter by event type
        filteredEvents = filteredEvents.filter((e) => e.type === eventFilter);
      }
    }

    return filteredEvents;
  }, [allEvents, isTeacher, currentMember, myKeikiIds, eventFilter]);

  // Days in selected month for add modal
  const daysInMonth = useMemo(() => {
    return getDaysInMonth(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Days in edit month for edit modal
  const daysInEditMonth = useMemo(() => {
    return getDaysInMonth(editMonth, editYear);
  }, [editMonth, editYear]);

  const daysInRecurringEndMonth = useMemo(() => {
    return getDaysInMonth(recurringEndMonth, recurringEndYear);
  }, [recurringEndMonth, recurringEndYear]);

  const daysInEditRecurringEndMonth = useMemo(() => {
    return getDaysInMonth(editRecurringEndMonth, editRecurringEndYear);
  }, [editRecurringEndMonth, editRecurringEndYear]);

  // Adjust day if it exceeds days in month
  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  // Adjust edit day if it exceeds days in month
  useEffect(() => {
    if (editDay > daysInEditMonth) {
      setEditDay(daysInEditMonth);
    }
  }, [daysInEditMonth, editDay]);

  useEffect(() => {
    if (recurringEndDay > daysInRecurringEndMonth) {
      setRecurringEndDay(daysInRecurringEndMonth);
    }
  }, [daysInRecurringEndMonth, recurringEndDay]);

  useEffect(() => {
    if (editRecurringEndDay > daysInEditRecurringEndMonth) {
      setEditRecurringEndDay(daysInEditRecurringEndMonth);
    }
  }, [daysInEditRecurringEndMonth, editRecurringEndDay]);

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = start.getDay();
    const paddedDays: (Date | null)[] = Array(startDay).fill(null);
    return [...paddedDays, ...days];
  }, [currentMonth]);

  // Memoize event lookup functions with useCallback
  const eventsOnDate = useCallback((date: Date) => {
    return events.filter((e) => isSameDay(parseISO(e.date), date));
  }, [events]);

  const showsOnDate = useCallback((date: Date) => {
    return shows.filter((s) => isSameDay(parseISO(s.date), date));
  }, [shows]);

  const handleCreateEvent = () => {
    if (!eventTitle.trim() || !currentHalauId) return;

    const eventDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

    // Include participantIds for all event types
    const participantIds = selectedParticipants.length > 0
      ? selectedParticipants
      : undefined;

    if (isRecurring) {
      const endDate = `${recurringEndYear}-${String(recurringEndMonth + 1).padStart(2, '0')}-${String(recurringEndDay).padStart(2, '0')}`;
      createRecurringEvents({
        halauId: currentHalauId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        date: eventDate,
        startTime: eventStartTime,
        endTime: eventEndTime || undefined,
        location: eventLocation.trim() || undefined,
        type: eventType,
        participantIds,
      }, recurringPattern, endDate);
    } else {
      createEvent({
        halauId: currentHalauId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || undefined,
        date: eventDate,
        startTime: eventStartTime,
        endTime: eventEndTime || undefined,
        location: eventLocation.trim() || undefined,
        type: eventType,
        participantIds,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetForm();
    setShowAddModal(false);
  };

  const resetForm = (dateToUse?: Date) => {
    const date = dateToUse || new Date();
    setEventTitle('');
    setEventDescription('');
    setSelectedDay(date.getDate());
    setSelectedMonth(date.getMonth());
    setSelectedYear(date.getFullYear());
    setEventStartTime('10:00 AM');
    setEventEndTime('');
    setEventLocation('');
    setCustomLocation('');
    setEventType('practice');
    setIsRecurring(false);
    setRecurringPattern('weekly');
    setSelectedParticipants([]);
    setShowParticipantPicker(false);
  };

  // Function to open add modal with a specific date
  const openAddModalWithDate = (date: Date) => {
    resetForm(date);
    setDatePickerMonth(date); // Set the calendar picker to show the selected date's month
    setShowAddModal(true);
  };

  const handleDeleteEvent = (event: Event) => {
    setEventToDelete(event);
    setShowDeleteModal(true);
  };

  const handleOpenEditModal = (event: Event) => {
    const eventDate = parseISO(event.date);
    setEditTitle(event.title);
    setEditDescription(event.description || '');
    setEditDay(eventDate.getDate());
    setEditMonth(eventDate.getMonth());
    setEditYear(eventDate.getFullYear());
    setEditDatePickerMonth(eventDate); // Set calendar picker to show event's month
    setEditStartTime(event.startTime);
    setEditEndTime(event.endTime || '');
    setEditLocation(event.location || '');
    setEditType(event.type);
    setEditParticipants(event.participantIds || []);
    // Initialize recurring state - set to not recurring by default since we're editing a single event
    // but allow user to make it recurring
    setEditIsRecurring(false);
    setEditRecurringPattern('weekly');
    // Set default end date to 3 months from the event date
    const threeMonthsLater = new Date(eventDate);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    setEditRecurringEndDay(threeMonthsLater.getDate());
    setEditRecurringEndMonth(threeMonthsLater.getMonth());
    setEditRecurringEndYear(threeMonthsLater.getFullYear());

    // For recurring events, show the scope selection modal first
    if (event.isRecurring && event.recurringGroupId) {
      setEditScope('single');
      setShowEditScopeModal(true);
    } else {
      setShowEditModal(true);
    }
  };

  const handleEditScopeSelect = (scope: 'single' | 'future') => {
    setEditScope(scope);
    setShowEditScopeModal(false);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!selectedEvent || !editTitle.trim() || !currentHalauId) return;

    const eventDate = `${editYear}-${String(editMonth + 1).padStart(2, '0')}-${String(editDay).padStart(2, '0')}`;

    // Include participantIds for all event types
    const participantIds = editParticipants.length > 0
      ? editParticipants
      : undefined;

    // Prepare the update data (without date for series updates)
    const updateData = {
      title: editTitle.trim(),
      description: editDescription.trim() || undefined,
      startTime: editStartTime,
      endTime: editEndTime || undefined,
      location: editLocation.trim() || undefined,
      type: editType,
      participantIds,
    };

    // Check if this is a recurring event and we're updating future events
    if (selectedEvent.isRecurring && selectedEvent.recurringGroupId && editScope === 'future') {
      // Update this event and all future events in the series
      updateRecurringSeries(selectedEvent.recurringGroupId, updateData, selectedEvent.date);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
      setSelectedEvent(null);
      setEditScope('single');
      return;
    }

    // If converting to recurring, create the recurring series
    if (editIsRecurring) {
      const endDate = `${editRecurringEndYear}-${String(editRecurringEndMonth + 1).padStart(2, '0')}-${String(editRecurringEndDay).padStart(2, '0')}`;

      // Calculate the next occurrence date based on the pattern
      const startDateObj = new Date(editYear, editMonth, editDay);
      let nextDate = new Date(startDateObj);

      switch (editRecurringPattern) {
        case 'daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDate.setDate(nextDate.getDate() + 14);
          break;
        case 'monthly':
          // For monthly, find the same occurrence of the same day of week in the next month
          const originalDayOfWeek = startDateObj.getDay();
          const weekOfMonth = Math.ceil(startDateObj.getDate() / 7);

          const nextMonth = startDateObj.getMonth() + 1;
          const nextYear = nextMonth > 11 ? startDateObj.getFullYear() + 1 : startDateObj.getFullYear();
          const adjustedMonth = nextMonth % 12;

          const nextMonthDate = new Date(nextYear, adjustedMonth, 1);
          const firstDayOfNextMonth = nextMonthDate.getDay();
          let daysUntilTargetDay = originalDayOfWeek - firstDayOfNextMonth;
          if (daysUntilTargetDay < 0) daysUntilTargetDay += 7;

          const targetDay = 1 + daysUntilTargetDay + (weekOfMonth - 1) * 7;
          const tentativeDate = new Date(nextYear, adjustedMonth, targetDay);

          if (tentativeDate.getMonth() === adjustedMonth) {
            nextDate = tentativeDate;
          } else {
            const lastDayOfMonth = new Date(nextYear, adjustedMonth + 1, 0).getDate();
            const lastOfMonth = new Date(nextYear, adjustedMonth, lastDayOfMonth);
            const lastDay = lastOfMonth.getDay();
            let daysBack = lastDay - originalDayOfWeek;
            if (daysBack < 0) daysBack += 7;
            nextDate = new Date(nextYear, adjustedMonth, lastDayOfMonth - daysBack);
          }
          break;
      }

      // Format next date as YYYY-MM-DD without timezone issues
      const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

      // Update the original event to be part of the recurring series
      updateEvent(selectedEvent.id, {
        ...updateData,
        date: eventDate,
        isRecurring: true,
        recurringPattern: editRecurringPattern,
        recurringEndDate: endDate,
      });

      // Create recurring events starting from the NEXT occurrence (not the current date)
      // Only if next date is before end date
      if (nextDateStr <= endDate) {
        createRecurringEvents({
          halauId: currentHalauId,
          title: editTitle.trim(),
          description: editDescription.trim() || undefined,
          date: nextDateStr,
          startTime: editStartTime,
          location: editLocation.trim() || undefined,
          type: editType,
          participantIds,
        }, editRecurringPattern, endDate);
      }
    } else {
      // Just update the single event (including date change for single event edits)
      updateEvent(selectedEvent.id, {
        ...updateData,
        date: eventDate,
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowEditModal(false);
    setSelectedEvent(null);
    setEditScope('single');
  };

  const resetEditForm = () => {
    setEditTitle('');
    setEditDescription('');
    setEditDay(1);
    setEditMonth(0);
    setEditYear(new Date().getFullYear());
    setEditStartTime('10:00 AM');
    setEditEndTime('');
    setEditLocation('');
    setEditCustomLocation('');
    setEditType('practice');
    setEditParticipants([]);
    setShowEditParticipantPicker(false);
    // Reset recurring state
    setEditIsRecurring(false);
    setEditRecurringPattern('weekly');
    setEditRecurringEndDay(new Date().getDate());
    setEditRecurringEndMonth(new Date().getMonth() + 3 > 11 ? (new Date().getMonth() + 3) % 12 : new Date().getMonth() + 3);
    setEditRecurringEndYear(new Date().getMonth() + 3 > 11 ? new Date().getFullYear() + 1 : new Date().getFullYear());
    setShowEditRecurringEndDayPicker(false);
    setShowEditRecurringEndMonthPicker(false);
    setShowEditRecurringEndYearPicker(false);
  };

  const confirmDeleteSingle = () => {
    if (eventToDelete) {
      deleteEvent(eventToDelete.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowDeleteModal(false);
    setEventToDelete(null);
    setSelectedEvent(null);
  };

  const confirmDeleteFuture = () => {
    if (eventToDelete?.recurringGroupId) {
      deleteRecurringSeries(eventToDelete.recurringGroupId, eventToDelete.date);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowDeleteModal(false);
    setEventToDelete(null);
    setSelectedEvent(null);
  };

  const confirmDeleteAll = () => {
    if (eventToDelete?.recurringGroupId) {
      deleteRecurringSeries(eventToDelete.recurringGroupId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowDeleteModal(false);
    setEventToDelete(null);
    setSelectedEvent(null);
  };

  const handleRSVP = (eventId: string, status: RSVPStatus) => {
    updateRSVP(eventId, status);
  };


  const renderCalendar = () => (
    <View className="px-4">
      {/* Month Navigation */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable
          onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronLeft size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
          {format(currentMonth, 'MMMM yyyy')}
        </Text>
        <Pressable
          onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="w-10 h-10 items-center justify-center rounded-full active:opacity-70"
        >
          <ChevronRight size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
      </View>

      {/* Day Headers */}
      <View className="flex-row mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <View key={day} className="flex-1 items-center">
            <Text className={cn('text-xs font-medium', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="flex-row flex-wrap">
        {calendarDays.map((date, index) => {
          if (!date) {
            return <View key={`empty-${index}`} className="w-[14.28%] aspect-square" />;
          }

          const dayEvents = eventsOnDate(date);
          const dayShows = showsOnDate(date);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isTodayDate = isToday(date);

          // Separate events by type
          const performanceEvents = dayEvents.filter((e: Event) => e.type === 'performance');
          const otherEvents = dayEvents.filter((e: Event) => e.type !== 'performance');
          // Shows count as performances (purple dot)
          const hasPerformances = performanceEvents.length > 0 || dayShows.length > 0;
          const hasOtherEvents = otherEvents.length > 0;

          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => setSelectedDate(date)}
              className={cn(
                'w-[14.28%] aspect-square items-center justify-center',
              )}
            >
              <View
                className={cn(
                  'w-10 h-10 rounded-full items-center justify-center',
                  isSelected && 'bg-gray-900',
                  isTodayDate && !isSelected && (isDark ? 'bg-gray-700' : 'bg-gray-200')
                )}
              >
                <Text
                  className={cn(
                    'text-base font-medium',
                    isSelected
                      ? 'text-white'
                      : !isCurrentMonth
                        ? isDark
                          ? 'text-gray-600'
                          : 'text-gray-300'
                        : isDark
                          ? 'text-white'
                          : 'text-gray-900'
                  )}
                >
                  {format(date, 'd')}
                </Text>
              </View>
              {(dayEvents.length > 0 || dayShows.length > 0) && (
                <View className="flex-row gap-1 mt-0.5">
                  {hasOtherEvents && (
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: theme.primary }}
                    />
                  )}
                  {hasPerformances && (
                    <View
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#8B5CF6' }}
                    />
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Calendar Legend */}
      <View className="flex-row justify-center gap-6 mt-4 pb-2">
        <View className="flex-row items-center">
          <View
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: theme.primary }}
          />
          <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Practice / Meeting / Other
          </Text>
        </View>
        <View className="flex-row items-center">
          <View
            className="w-3 h-3 rounded-full mr-2"
            style={{ backgroundColor: '#8B5CF6' }}
          />
          <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
            Performance
          </Text>
        </View>
      </View>

      {/* Selected Date Events */}
      {selectedDate && (
        <Animated.View entering={FadeIn.duration(300)} className="mt-6">
          <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
            {format(selectedDate, 'EEEE, MMMM d')}
          </Text>
          {(eventsOnDate(selectedDate).length > 0 || showsOnDate(selectedDate).length > 0) ? (
            <>
              {eventsOnDate(selectedDate).map((event: Event) => (
                <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} />
              ))}
              {showsOnDate(selectedDate).map((show: Show) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </>
          ) : (
            <View className={cn('rounded-2xl p-6 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
              <Text className={cn('text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                No events on this day
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Past Events collapsible section */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const pastEventsList = [...events]
          .filter((e) => parseISO(e.date) < today)
          .sort((a, b) => b.date.localeCompare(a.date)); // most recent first
        if (pastEventsList.length === 0) return null;
        return (
          <View className="mt-6">
            <Pressable
              onPress={() => setShowPastEvents(!showPastEvents)}
              className={cn(
                'flex-row items-center justify-between px-3 py-2.5 rounded-xl mb-2',
                isDark ? 'bg-gray-800/60' : 'bg-gray-100'
              )}
            >
              <View className="flex-row items-center gap-2">
                <Text className={cn('text-base font-semibold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                  Past Events
                </Text>
                <View className={cn('px-2 py-0.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {pastEventsList.length}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  transform: [{ rotate: showPastEvents ? '180deg' : '0deg' }],
                }}
              >
                <ChevronDown size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </View>
            </Pressable>
            {showPastEvents && (
              <Animated.View entering={FadeInDown.duration(250)}>
                {pastEventsList.map((event: Event) => (
                  <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} isPast />
                ))}
              </Animated.View>
            )}
          </View>
        );
      })()}
    </View>
  );

  const renderList = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
    const upcomingEvents = sortedEvents.filter((e) => parseISO(e.date) >= today);
    const pastEventsList = sortedEvents
      .filter((e) => parseISO(e.date) < today)
      .reverse(); // most recent first

    return (
      <View className="px-4">
        {upcomingEvents.length > 0 && (
          <>
            <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
              Upcoming
            </Text>
            {upcomingEvents.map((event, index) => (
              <Animated.View key={event.id} entering={FadeInDown.delay(index * 50).duration(400)}>
                <EventCard event={event} onPress={() => setSelectedEvent(event)} />
              </Animated.View>
            ))}
          </>
        )}

        {pastEventsList.length > 0 && (
          <View className="mt-6">
            <Pressable
              onPress={() => setShowPastEvents(!showPastEvents)}
              className={cn(
                'flex-row items-center justify-between px-3 py-2.5 rounded-xl mb-2',
                isDark ? 'bg-gray-800/60' : 'bg-gray-100'
              )}
            >
              <View className="flex-row items-center gap-2">
                <Text className={cn('text-base font-semibold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                  Past Events
                </Text>
                <View className={cn('px-2 py-0.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {pastEventsList.length}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  transform: [{ rotate: showPastEvents ? '180deg' : '0deg' }],
                }}
              >
                <ChevronDown size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </View>
            </Pressable>

            {showPastEvents && (
              <Animated.View entering={FadeInDown.duration(250)}>
                {pastEventsList.map((event) => (
                  <EventCard key={event.id} event={event} onPress={() => setSelectedEvent(event)} isPast />
                ))}
              </Animated.View>
            )}
          </View>
        )}

        {events.length === 0 && (
          <View className={cn('rounded-2xl p-8 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
            <CalendarIcon size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
              No events yet
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderArchive = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // All past events (most recent first), respecting visibility rules
    const pastEvents = [...events]
      .filter((e) => parseISO(e.date) < today)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Group by year then month
    const grouped: Record<string, Record<string, Event[]>> = {};
    pastEvents.forEach((e) => {
      const year = e.date.slice(0, 4);
      const monthKey = e.date.slice(0, 7); // YYYY-MM
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][monthKey]) grouped[year][monthKey] = [];
      grouped[year][monthKey].push(e);
    });

    const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

    // Stats
    const performanceCount = pastEvents.filter((e) => e.type === 'performance').length;
    const practiceCount = pastEvents.filter((e) => e.type === 'practice').length;
    const totalParticipants = new Set(
      pastEvents.flatMap((e) => e.participantIds ?? [])
    ).size;

    if (pastEvents.length === 0) {
      return (
        <View className="px-4 pt-6">
          <View className={cn('rounded-2xl p-10 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
            <Archive size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text className={cn('mt-4 text-base font-semibold text-center', isDark ? 'text-gray-300' : 'text-gray-600')}>
              No past events yet
            </Text>
            <Text className={cn('mt-1 text-sm text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Past events will appear here as a reference archive.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View className="px-4 pt-4">
        {/* Archive Header Banner */}
        <View
          className={cn('rounded-2xl p-4 mb-5', isDark ? 'bg-gray-800/80' : 'bg-white')}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.3 : 0.08,
            shadowRadius: 10,
            elevation: 6,
          }}
        >
          <View className="flex-row items-center mb-3">
            <View
              className="w-9 h-9 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: `${theme.primary}18` }}
            >
              <Archive size={18} color={theme.primary} />
            </View>
            <View>
              <Text className={cn('text-base font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Past Events Archive
              </Text>
              <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Reference guide for repeat shows &amp; past lineups
              </Text>
            </View>
          </View>
          {/* Stats Row */}
          <View className="flex-row gap-2">
            <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-700/60' : 'bg-gray-50')}>
              <Text className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>{pastEvents.length}</Text>
              <Text className={cn('text-[10px] font-medium mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>TOTAL</Text>
            </View>
            <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-700/60' : 'bg-gray-50')}>
              <Text className="text-xl font-bold text-purple-500">{performanceCount}</Text>
              <Text className={cn('text-[10px] font-medium mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>SHOWS</Text>
            </View>
            <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-700/60' : 'bg-gray-50')}>
              <Text className="text-xl font-bold text-blue-500">{practiceCount}</Text>
              <Text className={cn('text-[10px] font-medium mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>PRACTICES</Text>
            </View>
            {totalParticipants > 0 && (
              <View className={cn('flex-1 rounded-xl p-3 items-center', isDark ? 'bg-gray-700/60' : 'bg-gray-50')}>
                <Text className="text-xl font-bold" style={{ color: theme.primary }}>{totalParticipants}</Text>
                <Text className={cn('text-[10px] font-medium mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>MEMBERS</Text>
              </View>
            )}
          </View>
        </View>

        {/* Grouped by year / month */}
        {years.map((year) => {
          const monthKeys = Object.keys(grouped[year]).sort((a, b) => b.localeCompare(a));
          return (
            <View key={year} className="mb-6">
              {/* Year divider */}
              <View className="flex-row items-center mb-3">
                <View className={cn('h-px flex-1', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
                <Text className={cn('mx-3 text-sm font-bold tracking-widest', isDark ? 'text-gray-400' : 'text-gray-400')}>
                  {year}
                </Text>
                <View className={cn('h-px flex-1', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
              </View>

              {monthKeys.map((monthKey) => {
                const monthEvents = grouped[year][monthKey];
                const monthLabel = format(parseISO(`${monthKey}-01`), 'MMMM');
                return (
                  <View key={monthKey} className="mb-4">
                    {/* Month label */}
                    <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2 ml-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      {monthLabel}
                    </Text>

                    {monthEvents.map((event) => {
                      const eventParticipants = (event.participantIds ?? [])
                        .map((id) => members.find((m) => m.id === id))
                        .filter(Boolean);

                      return (
                        <Pressable
                          key={event.id}
                          onPress={() => setSelectedEvent(event)}
                          className={cn(
                            'rounded-2xl mb-3 overflow-hidden active:opacity-80',
                            isDark ? 'bg-gray-800/80' : 'bg-white'
                          )}
                          style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: isDark ? 0.35 : 0.1,
                            shadowRadius: 10,
                            elevation: 6,
                          }}
                        >
                          {/* Colored top accent bar */}
                          <View
                            style={{
                              height: 3,
                              backgroundColor: event.type === 'performance' ? '#8B5CF6' : theme.primary,
                            }}
                          />

                          <View className="p-4">
                            {/* Title row */}
                            <View className="flex-row items-start justify-between mb-2">
                              <View className="flex-1 mr-3">
                                <Text className={cn('font-bold text-base leading-snug', isDark ? 'text-white' : 'text-gray-900')}>
                                  {event.title}
                                </Text>
                                {event.description ? (
                                  <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={2}>
                                    {event.description}
                                  </Text>
                                ) : null}
                              </View>
                              <View className="items-end">
                                <View
                                  className={cn(
                                    'px-2 py-0.5 rounded-full',
                                    event.type === 'practice' && 'bg-blue-500/10',
                                    event.type === 'performance' && 'bg-purple-500/10',
                                    event.type === 'meeting' && 'bg-amber-500/10',
                                    event.type === 'workshop' && 'bg-green-500/10',
                                    event.type === 'other' && (isDark ? 'bg-gray-700' : 'bg-gray-100')
                                  )}
                                >
                                  <Text
                                    className={cn(
                                      'text-[11px] font-semibold capitalize',
                                      event.type === 'practice' && 'text-blue-600',
                                      event.type === 'performance' && 'text-purple-600',
                                      event.type === 'meeting' && 'text-amber-600',
                                      event.type === 'workshop' && 'text-green-600',
                                      event.type === 'other' && (isDark ? 'text-gray-400' : 'text-gray-500')
                                    )}
                                  >
                                    {event.type}
                                  </Text>
                                </View>
                                <Text className={cn('text-xs mt-1 font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                  {format(parseISO(event.date), 'MMM d')}
                                </Text>
                              </View>
                            </View>

                            {/* Meta row */}
                            <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                              <View className="flex-row items-center">
                                <Clock size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
                                <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                  {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                                </Text>
                              </View>
                              {event.location ? (
                                <View className="flex-row items-center">
                                  <MapPin size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
                                  <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={1}>
                                    {event.location}
                                  </Text>
                                </View>
                              ) : null}
                              {event.isRecurring ? (
                                <View className="flex-row items-center">
                                  <Repeat size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
                                  <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                    {event.recurringPattern}
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            {/* Participant lineup - the key reference info */}
                            {eventParticipants.length > 0 && (
                              <View className={cn('mt-3 pt-3 border-t', isDark ? 'border-gray-700' : 'border-gray-100')}>
                                <View className="flex-row items-center mb-2">
                                  <Users size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
                                  <Text className={cn('text-xs font-semibold ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                    LINEUP  ({eventParticipants.length})
                                  </Text>
                                </View>
                                <View className="flex-row flex-wrap gap-1.5">
                                  {eventParticipants.map((m) => m && (
                                    <View
                                      key={m.id}
                                      className={cn('px-2.5 py-1 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                                    >
                                      <Text className={cn('text-xs font-medium', isDark ? 'text-gray-200' : 'text-gray-700')}>
                                        {m.firstName} {m.lastName}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    );
  };

  const EventCard = ({ event, onPress, isPast }: { event: Event; onPress: () => void; isPast?: boolean }) => {
    const rsvps = getRSVPsByEvent(event.id);
    const myRSVP = currentMember ? getMemberRSVP(event.id, currentMember.id) : undefined;
    const goingCount = rsvps.filter((r) => r.status === 'going').length;

    return (
      <Pressable
        onPress={onPress}
        className={cn(
          'rounded-xl px-3 py-2.5 mb-2 active:opacity-80',
          isDark ? 'bg-gray-800/80' : 'bg-white',
          isPast && 'opacity-60'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.5 : 0.18,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View className="flex-row items-center">
          {/* Compact date box */}
          <View
            className="w-11 h-11 rounded-lg items-center justify-center mr-3"
            style={{ backgroundColor: (event.type === 'performance' ? theme.secondary : theme.primary) + '20' }}
          >
            <Text className="text-base font-bold" style={{ color: event.type === 'performance' ? theme.secondary : theme.primary }}>
              {format(parseISO(event.date), 'd')}
            </Text>
            <Text className="text-[10px] font-medium -mt-0.5" style={{ color: event.type === 'performance' ? theme.secondary : theme.primary }}>
              {format(parseISO(event.date), 'MMM').toUpperCase()}
            </Text>
          </View>

          {/* Content */}
          <View className="flex-1 mr-2">
            <View className="flex-row items-center">
              <Text className={cn('font-semibold text-sm flex-1', isDark ? 'text-white' : 'text-gray-900')} numberOfLines={1}>
                {event.title}
              </Text>
              <View
                className={cn(
                  'px-1.5 py-0.5 rounded ml-2',
                  event.type === 'practice' && 'bg-blue-500/10',
                  event.type === 'performance' && 'bg-purple-500/10',
                  event.type === 'meeting' && 'bg-amber-500/10',
                  event.type === 'workshop' && 'bg-green-500/10',
                  event.type === 'other' && (isDark ? 'bg-gray-700' : 'bg-gray-200')
                )}
              >
                <Text
                  className={cn(
                    'text-[10px] font-medium capitalize',
                    event.type === 'practice' && 'text-blue-600',
                    event.type === 'performance' && 'text-purple-600',
                    event.type === 'meeting' && 'text-amber-600',
                    event.type === 'workshop' && 'text-green-600',
                    event.type === 'other' && (isDark ? 'text-gray-400' : 'text-gray-600')
                  )}
                >
                  {event.type}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center mt-0.5">
              <Clock size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {event.startTime}
              </Text>
              {event.location && (
                <>
                  <Text className={cn('mx-1.5', isDark ? 'text-gray-600' : 'text-gray-300')}>•</Text>
                  <MapPin size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text className={cn('text-xs ml-1 flex-1', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={1}>
                    {event.location}
                  </Text>
                </>
              )}
              {event.isRecurring && (
                <>
                  <Text className={cn('mx-1.5', isDark ? 'text-gray-600' : 'text-gray-300')}>•</Text>
                  <Repeat size={10} color={isDark ? '#6B7280' : '#9CA3AF'} />
                </>
              )}
              {goingCount > 0 && (
                <>
                  <Text className={cn('mx-1.5', isDark ? 'text-gray-600' : 'text-gray-300')}>•</Text>
                  <Users size={12} color={theme.primary} />
                  <Text style={{ color: theme.primary }} className="text-xs ml-1">{goingCount}</Text>
                </>
              )}
            </View>
          </View>

          {/* Delete button for teachers */}
          {isTeacher && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); handleDeleteEvent(event); }}
              className="w-7 h-7 items-center justify-center rounded-full"
              style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)' }}
            >
              <Trash2 size={14} color="#EF4444" />
            </Pressable>
          )}
        </View>

        {/* Compact RSVP Buttons */}
        {!isPast && (
          <View className="flex-row gap-1.5 mt-2">
            {(['going', 'maybe', 'not_going'] as RSVPStatus[]).map((status) => (
              <Pressable
                key={status}
                onPress={(e) => { e.stopPropagation(); handleRSVP(event.id, status); }}
                className={cn(
                  'flex-1 py-1.5 rounded-lg items-center',
                  myRSVP?.status === status
                    ? status === 'going'
                      ? 'bg-gray-900'
                      : status === 'maybe'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    : isDark
                      ? 'bg-gray-700'
                      : 'bg-gray-100'
                )}
              >
                <Text
                  className={cn(
                    'text-xs font-medium',
                    myRSVP?.status === status
                      ? 'text-white'
                      : isDark
                        ? 'text-gray-300'
                        : 'text-gray-600'
                  )}
                >
                  {status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : "Can't"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  const ShowCard = ({ show }: { show: Show }) => {
    return (
      <Pressable
        onPress={() => router.push(`/shows/${show.id}`)}
        className={cn(
          'rounded-2xl p-4 mb-3',
          isDark ? 'bg-gray-800/80' : 'bg-white'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.5 : 0.18,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        <View className="flex-row">
          <View
            className="w-14 h-14 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: '#8B5CF620' }}
          >
            <Text className="text-xl font-bold" style={{ color: '#8B5CF6' }}>
              {format(parseISO(show.date), 'd')}
            </Text>
            <Text className="text-xs font-medium -mt-0.5" style={{ color: '#8B5CF6' }}>
              {format(parseISO(show.date), 'MMM').toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <View className="px-2 py-0.5 rounded-full mr-2 bg-purple-500/10">
                <Text className="text-xs font-medium text-purple-600">
                  Performance
                </Text>
              </View>
            </View>
            <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
              {show.name}
            </Text>
            <View className="flex-row items-center mt-1">
              <Clock size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {show.startTime}
              </Text>
              {show.location && (
                <>
                  <Text className={cn('mx-2', isDark ? 'text-gray-600' : 'text-gray-300')}>•</Text>
                  <MapPin size={14} color={isDark ? '#6B7280' : '#9CA3AF'} />
                  <Text className={cn('text-sm ml-1.5', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={1}>
                    {show.location}
                  </Text>
                </>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
      {/* Header */}
      <View
        className={cn('px-5 pb-4', isDark ? 'bg-black' : 'bg-white')}
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Events
          </Text>
          {isTeacher && (
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setShowFilterModal(true)}
                className={cn(
                  'w-10 h-10 rounded-full items-center justify-center',
                  eventFilter !== 'all' ? '' : (isDark ? 'bg-gray-800' : 'bg-gray-100')
                )}
                style={eventFilter !== 'all' ? { backgroundColor: `${theme.primary}20` } : undefined}
              >
                <Filter size={20} color={eventFilter !== 'all' ? theme.primary : (isDark ? '#9CA3AF' : '#6B7280')} />
              </Pressable>
              <Pressable
                onPress={() => openAddModalWithDate(selectedDate || new Date())}
                className="w-10 h-10 rounded-full items-center justify-center"
                style={{
                  backgroundColor: theme.primary,
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.6 : 0.35,
                  shadowRadius: 16,
                  elevation: 12,
                }}
              >
                <Plus size={24} color="white" />
              </Pressable>
            </View>
          )}
        </View>

        {/* Active Filter Indicator */}
        {isTeacher && eventFilter !== 'all' && (
          <Pressable
            onPress={() => setEventFilter('all')}
            className={cn(
              'flex-row items-center justify-between px-3 py-2 rounded-lg mb-3',
              isDark ? 'bg-gray-800' : 'bg-gray-100'
            )}
          >
            <View className="flex-row items-center">
              <Filter size={14} color={theme.primary} />
              <Text className={cn('ml-2 text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                {eventFilter === 'my_events' ? 'My Events' : eventFilter.charAt(0).toUpperCase() + eventFilter.slice(1)}
              </Text>
            </View>
            <X size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
        )}

        {/* View Toggle */}
        <View className={cn('flex-row rounded-xl p-1', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
          <Pressable
            onPress={() => setViewMode('calendar')}
            className={cn('flex-1 py-2 rounded-lg items-center justify-center flex-row gap-1', viewMode === 'calendar' && (isDark ? 'bg-gray-700' : 'bg-white'))}
          >
            <CalendarIcon size={14} color={viewMode === 'calendar' ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#6B7280' : '#9CA3AF')} />
            <Text
              className={cn(
                'text-center font-medium text-sm',
                viewMode === 'calendar'
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                    ? 'text-gray-400'
                    : 'text-gray-500'
              )}
            >
              Calendar
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('list')}
            className={cn('flex-1 py-2 rounded-lg items-center justify-center flex-row gap-1', viewMode === 'list' && (isDark ? 'bg-gray-700' : 'bg-white'))}
          >
            <List size={14} color={viewMode === 'list' ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#6B7280' : '#9CA3AF')} />
            <Text
              className={cn(
                'text-center font-medium text-sm',
                viewMode === 'list'
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                    ? 'text-gray-400'
                    : 'text-gray-500'
              )}
            >
              List
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('archive')}
            className={cn('flex-1 py-2 rounded-lg items-center justify-center flex-row gap-1', viewMode === 'archive' && (isDark ? 'bg-gray-700' : 'bg-white'))}
          >
            <Archive size={14} color={viewMode === 'archive' ? (isDark ? '#FFFFFF' : '#111827') : (isDark ? '#6B7280' : '#9CA3AF')} />
            <Text
              className={cn(
                'text-center font-medium text-sm',
                viewMode === 'archive'
                  ? isDark
                    ? 'text-white'
                    : 'text-gray-900'
                  : isDark
                    ? 'text-gray-400'
                    : 'text-gray-500'
              )}
            >
              Archive
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        {viewMode === 'calendar' ? renderCalendar() : viewMode === 'list' ? renderList() : renderArchive()}
      </ScrollView>

      {/* Add Event Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#FFFFFF' }}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => { setShowAddModal(false); resetForm(); }}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              New Event
            </Text>
            <Pressable
              onPress={handleCreateEvent}
              disabled={!eventTitle.trim()}
              className={cn(!eventTitle.trim() && 'opacity-50')}
            >
              <Check size={24} color={theme.primary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 150 }}>
            <View className="gap-4">
              {/* Event Title */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Event Title *
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="e.g., Weekly Practice"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={eventTitle}
                  onChangeText={setEventTitle}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* Event Type */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['practice', 'performance', 'meeting', 'workshop', 'other'] as Event['type'][]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setEventType(type)}
                      className={cn(
                        'px-4 py-2 rounded-full',
                        eventType === type ? 'bg-gray-900' : isDark ? 'bg-gray-800' : 'bg-gray-100'
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

              {/* Participants Selector - Show for all event types */}
              <Animated.View entering={FadeIn.duration(200)}>
                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {eventType === 'performance' ? 'Performers' : 'Participants'}
                  </Text>
                  <Pressable
                    onPress={() => setShowParticipantPicker(!showParticipantPicker)}
                    className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                  >
                    <View className="flex-row items-center flex-1">
                      <Users size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      <Text
                        className={cn(
                          'ml-3 text-base flex-1',
                          selectedParticipants.length > 0
                            ? (isDark ? 'text-white' : 'text-gray-900')
                            : (isDark ? 'text-gray-500' : 'text-gray-400')
                        )}
                        numberOfLines={1}
                      >
                        {selectedParticipants.length > 0
                          ? `${selectedParticipants.length} ${eventType === 'performance' ? 'performer' : 'participant'}${selectedParticipants.length > 1 ? 's' : ''} selected`
                          : eventType === 'performance' ? 'Select performers' : 'Select participants'}
                        </Text>
                      </View>
                      <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </Pressable>

                    {/* Selected Performers Preview */}
                    {selectedParticipants.length > 0 && !showParticipantPicker && (
                      <View className="flex-row flex-wrap gap-2 mt-2">
                        {selectedParticipants.slice(0, 5).map((participantId) => {
                          const member = members.find((m) => m.id === participantId);
                          if (!member) return null;
                          return (
                            <View
                              key={participantId}
                              className={cn('px-3 py-1.5 rounded-full flex-row items-center', isDark ? 'bg-purple-500/20' : 'bg-purple-100')}
                            >
                              <Text className="text-sm text-purple-600">
                                {member.firstName} {member.lastName?.charAt(0) ? `${member.lastName.charAt(0)}.` : ''}
                              </Text>
                              <Pressable
                                onPress={() => setSelectedParticipants((prev) => prev.filter((id) => id !== participantId))}
                                className="ml-1.5"
                              >
                                <X size={14} color="#8B5CF6" />
                              </Pressable>
                            </View>
                          );
                        })}
                        {selectedParticipants.length > 5 && (
                          <View className={cn('px-3 py-1.5 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                            <Text className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                              +{selectedParticipants.length - 5} more
                            </Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Participant Picker Dropdown */}
                    {showParticipantPicker && (
                      <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                        {/* Class-based Selection Options */}
                        <View className={cn('border-b', isDark ? 'border-gray-700' : 'border-gray-100')}>
                          <Text className={cn('text-xs font-medium px-4 pt-3 pb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            SELECT BY CLASS
                          </Text>
                          {/* All option */}
                          <Pressable
                            onPress={() => {
                              setSelectedParticipants(members.map((m) => m.id));
                            }}
                            className={cn(
                              'px-4 py-2.5 flex-row items-center justify-between',
                              isDark ? 'active:bg-gray-800' : 'active:bg-gray-50'
                            )}
                          >
                            <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              All
                            </Text>
                            {selectedParticipants.length === members.length && members.length > 0 ? (
                              <View className="w-5 h-5 rounded-full bg-purple-500 items-center justify-center">
                                <Check size={12} color="white" />
                              </View>
                            ) : (
                              <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                {members.length} members
                              </Text>
                            )}
                          </Pressable>
                          {/* Dynamic class levels */}
                          {classLevels.map((classLevel) => {
                            const classMembers = members.filter((m) => m.classLevel === classLevel.value);
                            const classMemberIds = classMembers.map((m) => m.id);
                            const selectedCount = classMembers.filter((m) => selectedParticipants.includes(m.id)).length;
                            const allSelected = classMembers.length > 0 && selectedCount === classMembers.length;

                            return (
                              <Pressable
                                key={classLevel.id}
                                onPress={() => {
                                  if (allSelected) {
                                    // Remove all from this class
                                    setSelectedParticipants((prev) => prev.filter((id) => !classMemberIds.includes(id)));
                                  } else {
                                    // Add all from this class
                                    setSelectedParticipants((prev) => [...new Set([...prev, ...classMemberIds])]);
                                  }
                                }}
                                className={cn(
                                  'px-4 py-2.5 flex-row items-center justify-between',
                                  isDark ? 'active:bg-gray-800' : 'active:bg-gray-50'
                                )}
                              >
                                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                                  {classLevel.label}
                                </Text>
                                {allSelected ? (
                                  <View className="w-5 h-5 rounded-full bg-purple-500 items-center justify-center">
                                    <Check size={12} color="white" />
                                  </View>
                                ) : (
                                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                    {selectedCount > 0 ? `${selectedCount}/` : ''}{classMembers.length}
                                  </Text>
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                        {/* Clear All */}
                        <View className={cn('flex-row justify-end px-4 py-2 border-b', isDark ? 'border-gray-700' : 'border-gray-100')}>
                          <Pressable
                            onPress={() => setSelectedParticipants([])}
                          >
                            <Text className={cn('font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>Clear All</Text>
                          </Pressable>
                        </View>
                        {/* Individual Members */}
                        <Text className={cn('text-xs font-medium px-4 pt-3 pb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          INDIVIDUAL MEMBERS
                        </Text>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          {[...members].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((member) => {
                            const isSelected = selectedParticipants.includes(member.id);
                            return (
                              <Pressable
                                key={member.id}
                                onPress={() => {
                                  setSelectedParticipants((prev) =>
                                    isSelected
                                      ? prev.filter((id) => id !== member.id)
                                      : [...prev, member.id]
                                  );
                                }}
                                className={cn(
                                  'px-4 py-3 border-b flex-row items-center justify-between',
                                  isDark ? 'border-gray-700' : 'border-gray-100',
                                  isSelected && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                )}
                              >
                                <View className="flex-row items-center flex-1">
                                  <View
                                    className={cn(
                                      'w-10 h-10 rounded-full items-center justify-center mr-3',
                                      isDark ? 'bg-gray-700' : 'bg-gray-200'
                                    )}
                                  >
                                    <Text className={cn('font-bold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                                      {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                                    </Text>
                                  </View>
                                  <View className="flex-1">
                                    <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                                      {member.firstName} {member.lastName}
                                    </Text>
                                    <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                      {member.classLevel ? getClassLabel(member.classLevel) : member.role}
                                    </Text>
                                  </View>
                                </View>
                                <View
                                  className={cn(
                                    'w-6 h-6 rounded-full items-center justify-center',
                                    isSelected
                                      ? 'bg-purple-500'
                                      : isDark ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-300'
                                  )}
                                >
                                  {isSelected && <Check size={14} color="white" />}
                                </View>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        <Pressable
                          onPress={() => setShowParticipantPicker(false)}
                          className={cn('py-3 items-center border-t', isDark ? 'border-gray-700' : 'border-gray-100')}
                        >
                          <Text style={{ color: theme.primary }} className="font-semibold">Done</Text>
                        </Pressable>
                      </View>
                  )}
                  </View>
                </Animated.View>

              {/* Date Selection - Calendar Picker */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Date
                </Text>
                <Pressable
                  onPress={() => setShowDatePicker(!showDatePicker)}
                  className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <View className="flex-row items-center">
                    <CalendarIcon size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {format(new Date(selectedYear, selectedMonth, selectedDay), 'EEEE, MMMM d, yyyy')}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                {showDatePicker && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border p-3', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                    {/* Month Navigation */}
                    <View className="flex-row items-center justify-between mb-3">
                      <Pressable
                        onPress={() => setDatePickerMonth(subMonths(datePickerMonth, 1))}
                        className={cn('w-8 h-8 rounded-full items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      >
                        <ChevronLeft size={20} color={isDark ? '#FFFFFF' : '#111827'} />
                      </Pressable>
                      <Text className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                        {format(datePickerMonth, 'MMMM yyyy')}
                      </Text>
                      <Pressable
                        onPress={() => setDatePickerMonth(addMonths(datePickerMonth, 1))}
                        className={cn('w-8 h-8 rounded-full items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      >
                        <ChevronRight size={20} color={isDark ? '#FFFFFF' : '#111827'} />
                      </Pressable>
                    </View>

                    {/* Day Headers */}
                    <View className="flex-row mb-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <View key={index} className="w-[14.28%] items-center">
                          <Text className={cn('text-xs font-medium', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {day}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Calendar Grid */}
                    <View className="flex-row flex-wrap">
                      {(() => {
                        const monthStart = startOfMonth(datePickerMonth);
                        const monthEnd = endOfMonth(datePickerMonth);
                        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                        const startDayOfWeek = monthStart.getDay();
                        const paddingDays = Array(startDayOfWeek).fill(null);
                        const allDays = [...paddingDays, ...days];

                        return allDays.map((date, index) => {
                          if (!date) {
                            return <View key={`empty-${index}`} className="w-[14.28%] aspect-square" />;
                          }

                          const isSelectedDate =
                            date.getDate() === selectedDay &&
                            date.getMonth() === selectedMonth &&
                            date.getFullYear() === selectedYear;
                          const isTodayDate = isToday(date);

                          return (
                            <Pressable
                              key={date.toISOString()}
                              onPress={() => {
                                setSelectedDay(date.getDate());
                                setSelectedMonth(date.getMonth());
                                setSelectedYear(date.getFullYear());
                                setShowDatePicker(false);
                              }}
                              className="w-[14.28%] aspect-square items-center justify-center"
                            >
                              <View
                                className={cn(
                                  'w-9 h-9 rounded-full items-center justify-center',
                                  isSelectedDate && 'bg-gray-900',
                                  isTodayDate && !isSelectedDate && (isDark ? 'bg-gray-700' : 'bg-gray-200')
                                )}
                              >
                                <Text
                                  className={cn(
                                    'text-sm font-medium',
                                    isSelectedDate
                                      ? 'text-white'
                                      : isDark
                                        ? 'text-white'
                                        : 'text-gray-900'
                                  )}
                                >
                                  {format(date, 'd')}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        });
                      })()}
                    </View>
                  </View>
                )}
              </View>

              {/* Start Time */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Start Time
                </Text>
                <Pressable
                  onPress={() => setShowTimePicker(!showTimePicker)}
                  className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <View className="flex-row items-center">
                    <Clock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      {eventStartTime}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                {showTimePicker && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {TIME_OPTIONS.map((time) => (
                        <Pressable
                          key={time}
                          onPress={() => {
                            setEventStartTime(time);
                            setShowTimePicker(false);
                          }}
                          className={cn(
                            'px-4 py-3 border-b',
                            isDark ? 'border-gray-700' : 'border-gray-100',
                            eventStartTime === time && (isDark ? 'bg-teal-500/30' : 'bg-teal-50')
                          )}
                        >
                          <Text
                            className={cn(
                              'text-base',
                              eventStartTime === time
                                ? 'font-semibold'
                                : isDark ? 'text-white' : 'text-gray-700'
                            )}
                          >
                            {time}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* End Time */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  End Time (optional)
                </Text>
                <Pressable
                  onPress={() => setShowEndTimePicker2(!showEndTimePicker2)}
                  className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <View className="flex-row items-center">
                    <Clock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', eventEndTime ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-500' : 'text-gray-400'))}>
                      {eventEndTime || 'No end time'}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                {showEndTimePicker2 && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      <Pressable
                        onPress={() => {
                          setEventEndTime('');
                          setShowEndTimePicker2(false);
                        }}
                        className={cn(
                          'px-4 py-3 border-b',
                          isDark ? 'border-gray-700' : 'border-gray-100',
                          eventEndTime === '' && (isDark ? 'bg-teal-500/30' : 'bg-teal-50')
                        )}
                      >
                        <Text className={cn('text-base', isDark ? 'text-gray-400' : 'text-gray-500')}>
                          No end time
                        </Text>
                      </Pressable>
                      {TIME_OPTIONS.map((time) => (
                        <Pressable
                          key={time}
                          onPress={() => {
                            setEventEndTime(time);
                            setShowEndTimePicker2(false);
                          }}
                          className={cn(
                            'px-4 py-3 border-b',
                            isDark ? 'border-gray-700' : 'border-gray-100',
                            eventEndTime === time && (isDark ? 'bg-teal-500/30' : 'bg-teal-50')
                          )}
                        >
                          <Text
                            className={cn(
                              'text-base',
                              eventEndTime === time
                                ? 'font-semibold'
                                : isDark ? 'text-white' : 'text-gray-700'
                            )}
                          >
                            {time}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Location
                </Text>
                <View className={cn('flex-row items-center px-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <MapPin size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <TextInput
                    className={cn('flex-1 py-3 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
                    placeholder="Enter location..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={eventLocation}
                    onChangeText={setEventLocation}
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>
              </View>

              {/* Recurring Toggle */}
              <View>
                <Pressable
                  onPress={() => setIsRecurring(!isRecurring)}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3 rounded-xl',
                    isDark ? 'bg-gray-800' : 'bg-gray-100'
                  )}
                >
                  <View className="flex-row items-center">
                    <Repeat size={20} color={isRecurring ? theme.primary : isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      Recurring Event
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'w-12 h-7 rounded-full p-1',
                      isRecurring ? 'bg-gray-900' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                    )}
                  >
                    <View
                      className={cn(
                        'w-5 h-5 rounded-full bg-white',
                        isRecurring && 'ml-auto'
                      )}
                    />
                  </View>
                </Pressable>
              </View>

              {/* Recurring Options */}
              {isRecurring && (
                <Animated.View entering={FadeIn.duration(200)} className="gap-4">
                  {/* Pattern */}
                  <View>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Repeat
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((pattern) => (
                        <Pressable
                          key={pattern}
                          onPress={() => setRecurringPattern(pattern)}
                          className={cn(
                            'px-4 py-2 rounded-full',
                            recurringPattern === pattern ? 'bg-gray-900' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                          )}
                        >
                          <Text
                            className={cn(
                              'font-medium capitalize',
                              recurringPattern === pattern ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                            )}
                          >
                            {pattern === 'biweekly' ? 'Bi-weekly' : pattern}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* End Date */}
                  <View>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      End Date
                    </Text>
                    <View className="flex-row gap-2">
                      {/* Month */}
                      <View className="flex-1">
                        <Pressable
                          onPress={() => { setShowRecurringEndMonthPicker(!showRecurringEndMonthPicker); setShowRecurringEndDayPicker(false); setShowRecurringEndYearPicker(false); }}
                          className={cn('px-3 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                        >
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {MONTHS[recurringEndMonth].substring(0, 3)}
                          </Text>
                        </Pressable>
                        <DropdownPicker
                          items={MONTHS.map((_, i) => i)}
                          selectedValue={recurringEndMonth}
                          onSelect={(v) => setRecurringEndMonth(v as number)}
                          isVisible={showRecurringEndMonthPicker}
                          onClose={() => setShowRecurringEndMonthPicker(false)}
                          formatItem={(m) => MONTHS[m as number]}
                          isDark={isDark}
                        />
                      </View>

                      {/* Day */}
                      <View className="flex-1">
                        <Pressable
                          onPress={() => { setShowRecurringEndDayPicker(!showRecurringEndDayPicker); setShowRecurringEndMonthPicker(false); setShowRecurringEndYearPicker(false); }}
                          className={cn('px-3 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                        >
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {recurringEndDay}
                          </Text>
                        </Pressable>
                        <DropdownPicker
                          items={Array.from({ length: daysInRecurringEndMonth }, (_, i) => i + 1)}
                          selectedValue={recurringEndDay}
                          onSelect={(v) => setRecurringEndDay(v as number)}
                          isVisible={showRecurringEndDayPicker}
                          onClose={() => setShowRecurringEndDayPicker(false)}
                          isDark={isDark}
                        />
                      </View>

                      {/* Year */}
                      <View className="flex-1">
                        <Pressable
                          onPress={() => { setShowRecurringEndYearPicker(!showRecurringEndYearPicker); setShowRecurringEndDayPicker(false); setShowRecurringEndMonthPicker(false); }}
                          className={cn('px-3 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                        >
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {recurringEndYear}
                          </Text>
                        </Pressable>
                        <DropdownPicker
                          items={YEARS}
                          selectedValue={recurringEndYear}
                          onSelect={(v) => setRecurringEndYear(v as number)}
                          isVisible={showRecurringEndYearPicker}
                          onClose={() => setShowRecurringEndYearPicker(false)}
                          isDark={isDark}
                        />
                      </View>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Description */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Description
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="Add details about this event..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={eventDescription}
                  onChangeText={setEventDescription}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Event Overlay - No Modal to prevent iOS freeze */}
      {showDeleteModal && (
        <>
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => { setShowDeleteModal(false); setEventToDelete(null); }}
            style={{ zIndex: 50 }}
          />
          <View
            className={cn('absolute left-8 right-8 rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
            style={{ top: '30%', zIndex: 51 }}
          >
            <Text className={cn('text-lg font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
              Delete Event
            </Text>
            <Text className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {eventToDelete?.isRecurring
                ? 'This is a recurring event. What would you like to delete?'
                : 'Are you sure you want to delete this event?'}
            </Text>

            <View className="gap-2">
              <Pressable
                onPress={confirmDeleteSingle}
                className={cn('py-3 rounded-xl items-center', isDark ? 'bg-red-500/20' : 'bg-red-50')}
              >
                <Text className="text-red-500 font-medium">
                  {eventToDelete?.isRecurring ? 'Delete This Event Only' : 'Delete Event'}
                </Text>
              </Pressable>

              {eventToDelete?.isRecurring && (
                <>
                  <Pressable
                    onPress={confirmDeleteFuture}
                    className={cn('py-3 rounded-xl items-center', isDark ? 'bg-orange-500/20' : 'bg-orange-50')}
                  >
                    <Text className="text-orange-500 font-medium">Delete This & Future Events</Text>
                  </Pressable>

                  <Pressable
                    onPress={confirmDeleteAll}
                    className={cn('py-3 rounded-xl items-center', isDark ? 'bg-red-600/20' : 'bg-red-100')}
                  >
                    <Text className="text-red-600 font-medium">Delete All Events in Series</Text>
                  </Pressable>
                </>
              )}

              <Pressable
                onPress={() => { setShowDeleteModal(false); setEventToDelete(null); }}
                className={cn('py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
              >
                <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* Edit Scope Overlay - No Modal to prevent iOS freeze */}
      {showEditScopeModal && (
        <>
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => setShowEditScopeModal(false)}
            style={{ zIndex: 50 }}
          />
          <View
            className={cn('absolute left-8 right-8 rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}
            style={{ top: '30%', zIndex: 51 }}
          >
            <Text className={cn('text-lg font-bold mb-2', isDark ? 'text-white' : 'text-gray-900')}>
              Edit Recurring Event
            </Text>
            <Text className={cn('mb-4', isDark ? 'text-gray-400' : 'text-gray-600')}>
              This is a recurring event. What would you like to edit?
            </Text>

            <View className="gap-2">
              <Pressable
                onPress={() => handleEditScopeSelect('single')}
                className={cn('py-3 rounded-xl items-center', isDark ? 'bg-blue-500/20' : 'bg-blue-50')}
              >
                <Text className="text-blue-500 font-medium">Edit This Event Only</Text>
              </Pressable>

              <Pressable
                onPress={() => handleEditScopeSelect('future')}
                className={cn('py-3 rounded-xl items-center', isDark ? 'bg-purple-500/20' : 'bg-purple-50')}
              >
                <Text className="text-purple-500 font-medium">Edit This & Future Events</Text>
              </Pressable>

              <Pressable
                onPress={() => { setShowEditScopeModal(false); }}
                className={cn('py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
              >
                <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}

      {/* Event Detail Modal */}
      <Modal visible={!!selectedEvent && !showEditModal && !showEditScopeModal} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setSelectedEvent(null)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              {selectedEvent && (
                <Animated.View entering={FadeInDown.duration(300)}>
                  {/* Handle bar */}
                  <View className="items-center pt-3 pb-4">
                    <View className={cn('w-10 h-1 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-300')} />
                  </View>

                  {/* Event Header */}
                  <View className="px-5 pb-4">
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 mr-4">
                        <View className="flex-row items-center mb-2">
                          <View
                            className={cn(
                              'px-2 py-0.5 rounded-full mr-2',
                              selectedEvent.type === 'practice' && 'bg-blue-500/10',
                              selectedEvent.type === 'performance' && 'bg-purple-500/10',
                              selectedEvent.type === 'meeting' && 'bg-amber-500/10',
                              selectedEvent.type === 'workshop' && 'bg-green-500/10',
                              selectedEvent.type === 'other' && (isDark ? 'bg-gray-700' : 'bg-gray-200')
                            )}
                          >
                            <Text
                              className={cn(
                                'text-xs font-medium capitalize',
                                selectedEvent.type === 'practice' && 'text-blue-600',
                                selectedEvent.type === 'performance' && 'text-purple-600',
                                selectedEvent.type === 'meeting' && 'text-amber-600',
                                selectedEvent.type === 'workshop' && 'text-green-600',
                                selectedEvent.type === 'other' && (isDark ? 'text-gray-400' : 'text-gray-600')
                              )}
                            >
                              {selectedEvent.type}
                            </Text>
                          </View>
                          {selectedEvent.isRecurring && (
                            <View className="flex-row items-center">
                              <Repeat size={12} color={isDark ? '#6B7280' : '#9CA3AF'} />
                              <Text className={cn('text-xs ml-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                {selectedEvent.recurringPattern}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                          {selectedEvent.title}
                        </Text>
                      </View>
                      <View
                        className="w-14 h-14 rounded-xl items-center justify-center"
                        style={{ backgroundColor: (selectedEvent.type === 'performance' ? theme.secondary : theme.primary) + '20' }}
                      >
                        <Text className="text-xl font-bold" style={{ color: selectedEvent.type === 'performance' ? theme.secondary : theme.primary }}>
                          {format(parseISO(selectedEvent.date), 'd')}
                        </Text>
                        <Text className="text-xs font-medium -mt-0.5" style={{ color: selectedEvent.type === 'performance' ? theme.secondary : theme.primary }}>
                          {format(parseISO(selectedEvent.date), 'MMM').toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    {/* Event Details */}
                    <View className="gap-3">
                      <View className="flex-row items-center">
                        <CalendarIcon size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        <Text className={cn('ml-3 text-base', isDark ? 'text-gray-300' : 'text-gray-700')}>
                          {format(parseISO(selectedEvent.date), 'EEEE, MMMM d, yyyy')}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Clock size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        <Text className={cn('ml-3 text-base', isDark ? 'text-gray-300' : 'text-gray-700')}>
                          {selectedEvent.startTime}
                        </Text>
                      </View>
                      {selectedEvent.location && (
                        <View className="flex-row items-center">
                          <MapPin size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={cn('ml-3 text-base', isDark ? 'text-gray-300' : 'text-gray-700')}>
                            {selectedEvent.location}
                          </Text>
                        </View>
                      )}
                      {selectedEvent.participantIds && selectedEvent.participantIds.length > 0 && (
                        <View className="flex-row items-center">
                          <Users size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          <Text className={cn('ml-3 text-base', isDark ? 'text-gray-300' : 'text-gray-700')}>
                            {selectedEvent.participantIds.length} performer{selectedEvent.participantIds.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    {selectedEvent.description && (
                      <Text className={cn('mt-4 text-base', isDark ? 'text-gray-400' : 'text-gray-600')}>
                        {selectedEvent.description}
                      </Text>
                    )}

                    {/* RSVP Section for Participants */}
                    {selectedEvent.type === 'performance' &&
                     selectedEvent.participantIds &&
                     currentMember &&
                     (selectedEvent.participantIds.includes(currentMember.id) ||
                      myKeikiIds.some(keikiId => selectedEvent.participantIds?.includes(keikiId))) && (
                      <View className={cn('mt-5 p-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-purple-50')}>
                        <Text className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                          Your Response
                        </Text>
                        {(() => {
                          const myRsvp = getMyRsvp(selectedEvent.id);
                          return (
                            <View className="flex-row gap-2">
                              <Pressable
                                onPress={() => {
                                  updateRSVP(selectedEvent.id, 'going');
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={cn(
                                  'flex-1 py-3 rounded-xl items-center',
                                  myRsvp?.status === 'going'
                                    ? 'bg-green-500'
                                    : isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                                )}
                              >
                                <Text className={cn(
                                  'font-semibold',
                                  myRsvp?.status === 'going' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  Going
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  updateRSVP(selectedEvent.id, 'maybe');
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={cn(
                                  'flex-1 py-3 rounded-xl items-center',
                                  myRsvp?.status === 'maybe'
                                    ? 'bg-amber-500'
                                    : isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                                )}
                              >
                                <Text className={cn(
                                  'font-semibold',
                                  myRsvp?.status === 'maybe' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  Maybe
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => {
                                  updateRSVP(selectedEvent.id, 'not_going');
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                className={cn(
                                  'flex-1 py-3 rounded-xl items-center',
                                  myRsvp?.status === 'not_going'
                                    ? 'bg-red-500'
                                    : isDark ? 'bg-gray-700' : 'bg-white border border-gray-200'
                                )}
                              >
                                <Text className={cn(
                                  'font-semibold',
                                  myRsvp?.status === 'not_going' ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700'
                                )}>
                                  Can't Go
                                </Text>
                              </Pressable>
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {/* RSVP Summary for Kumu/Admin */}
                    {isTeacher && selectedEvent.type === 'performance' && selectedEvent.participantIds && selectedEvent.participantIds.length > 0 && (
                      <View className={cn('mt-5 p-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                        <Text className={cn('font-semibold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                          Performer Responses
                        </Text>
                        {(() => {
                          const eventRsvps = getEventRsvps(selectedEvent.id);
                          const goingCount = eventRsvps.filter(r => r.status === 'going').length;
                          const maybeCount = eventRsvps.filter(r => r.status === 'maybe').length;
                          const notGoingCount = eventRsvps.filter(r => r.status === 'not_going').length;
                          const pendingCount = (selectedEvent.participantIds?.length || 0) - eventRsvps.length;

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
                    )}
                  </View>

                  {/* Action Buttons for Kumu/Admin */}
                  {isTeacher && (
                    <View className="px-5 pt-2 gap-3">
                      <Pressable
                        onPress={() => handleOpenEditModal(selectedEvent)}
                        className="py-3.5 rounded-xl items-center active:opacity-80"
                        style={{
                          backgroundColor: theme.primary,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: isDark ? 0.5 : 0.18,
                          shadowRadius: 12,
                          elevation: 10,
                        }}
                      >
                        <Text className="text-white font-semibold text-base">Edit Event</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteEvent(selectedEvent)}
                        className={cn('py-3.5 rounded-xl items-center active:opacity-80', isDark ? 'bg-red-500/20' : 'bg-red-50')}
                        style={{
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: isDark ? 0.4 : 0.1,
                          shadowRadius: 8,
                          elevation: 6,
                        }}
                      >
                        <Text className="text-red-500 font-semibold text-base">Delete Event</Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Close button */}
                  <View className="px-5 pt-3">
                    <Pressable
                      onPress={() => setSelectedEvent(null)}
                      className={cn('py-3.5 rounded-xl items-center active:opacity-80', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: isDark ? 0.4 : 0.1,
                        shadowRadius: 8,
                        elevation: 6,
                      }}
                    >
                      <Text className={cn('font-semibold text-base', isDark ? 'text-gray-300' : 'text-gray-600')}>Close</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Event Modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => { setShowEditModal(false); resetEditForm(); }}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Edit Event
            </Text>
            <Pressable
              onPress={handleSaveEdit}
              disabled={!editTitle.trim()}
              className={cn(!editTitle.trim() && 'opacity-50')}
            >
              <Check size={24} color={theme.primary} />
            </Pressable>
          </View>

          <ScrollView ref={editScrollRef} className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 200 }}>
            <View className="gap-4">
              {/* Event Title */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Event Title *
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="e.g., Weekly Practice"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* Event Type */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Type
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['practice', 'performance', 'meeting', 'workshop', 'other'] as Event['type'][]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setEditType(type)}
                      className={cn(
                        'px-4 py-2 rounded-full',
                        editType === type ? 'bg-gray-900' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium capitalize',
                          editType === type ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                        )}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Participants Selector - Show for all event types */}
              <Animated.View entering={FadeIn.duration(200)}>
                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {editType === 'performance' ? 'Performers' : 'Participants'}
                  </Text>
                  <Pressable
                    onPress={() => setShowEditParticipantPicker(!showEditParticipantPicker)}
                    className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                  >
                    <View className="flex-row items-center flex-1">
                      <Users size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      <Text
                        className={cn(
                          'ml-3 text-base flex-1',
                          editParticipants.length > 0
                            ? (isDark ? 'text-white' : 'text-gray-900')
                            : (isDark ? 'text-gray-500' : 'text-gray-400')
                        )}
                        numberOfLines={1}
                      >
                        {editParticipants.length > 0
                          ? `${editParticipants.length} ${editType === 'performance' ? 'performer' : 'participant'}${editParticipants.length > 1 ? 's' : ''} selected`
                          : editType === 'performance' ? 'Select performers' : 'Select participants'}
                      </Text>
                    </View>
                    <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </Pressable>

                    {/* Participant Picker Dropdown */}
                    {showEditParticipantPicker && (
                      <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                        {/* Class-based Selection Options */}
                        <View className={cn('border-b', isDark ? 'border-gray-700' : 'border-gray-100')}>
                          <Text className={cn('text-xs font-medium px-4 pt-3 pb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            SELECT BY CLASS
                          </Text>
                          {/* All option */}
                          <Pressable
                            onPress={() => {
                              setEditParticipants(members.map((m) => m.id));
                            }}
                            className={cn(
                              'px-4 py-2.5 flex-row items-center justify-between',
                              isDark ? 'active:bg-gray-800' : 'active:bg-gray-50'
                            )}
                          >
                            <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              All
                            </Text>
                            {editParticipants.length === members.length && members.length > 0 ? (
                              <View className="w-5 h-5 rounded-full bg-purple-500 items-center justify-center">
                                <Check size={12} color="white" />
                              </View>
                            ) : (
                              <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                {members.length} members
                              </Text>
                            )}
                          </Pressable>
                          {/* Dynamic class levels */}
                          {classLevels.map((classLevel) => {
                            const classMembers = members.filter((m) => m.classLevel === classLevel.value);
                            const classMemberIds = classMembers.map((m) => m.id);
                            const selectedCount = classMembers.filter((m) => editParticipants.includes(m.id)).length;
                            const allSelected = classMembers.length > 0 && selectedCount === classMembers.length;

                            return (
                              <Pressable
                                key={classLevel.id}
                                onPress={() => {
                                  if (allSelected) {
                                    setEditParticipants((prev) => prev.filter((id) => !classMemberIds.includes(id)));
                                  } else {
                                    setEditParticipants((prev) => [...new Set([...prev, ...classMemberIds])]);
                                  }
                                }}
                                className={cn(
                                  'px-4 py-2.5 flex-row items-center justify-between',
                                  isDark ? 'active:bg-gray-800' : 'active:bg-gray-50'
                                )}
                              >
                                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                                  {classLevel.label}
                                </Text>
                                {allSelected ? (
                                  <View className="w-5 h-5 rounded-full bg-purple-500 items-center justify-center">
                                    <Check size={12} color="white" />
                                  </View>
                                ) : (
                                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                    {selectedCount > 0 ? `${selectedCount}/` : ''}{classMembers.length}
                                  </Text>
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                        {/* Clear All */}
                        <View className={cn('flex-row justify-end px-4 py-2 border-b', isDark ? 'border-gray-700' : 'border-gray-100')}>
                          <Pressable onPress={() => setEditParticipants([])}>
                            <Text className={cn('font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>Clear All</Text>
                          </Pressable>
                        </View>
                        {/* Individual Members */}
                        <Text className={cn('text-xs font-medium px-4 pt-3 pb-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          INDIVIDUAL MEMBERS
                        </Text>
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          {[...members].sort((a, b) => a.lastName.localeCompare(b.lastName)).map((member) => {
                            const isSelected = editParticipants.includes(member.id);
                            return (
                              <Pressable
                                key={member.id}
                                onPress={() => {
                                  setEditParticipants((prev) =>
                                    isSelected
                                      ? prev.filter((id) => id !== member.id)
                                      : [...prev, member.id]
                                  );
                                }}
                                className={cn(
                                  'px-4 py-3 border-b flex-row items-center justify-between',
                                  isDark ? 'border-gray-700' : 'border-gray-100',
                                  isSelected && (isDark ? 'bg-purple-500/20' : 'bg-purple-50')
                                )}
                              >
                                <View className="flex-row items-center flex-1">
                                  <View className={cn('w-10 h-10 rounded-full items-center justify-center mr-3', isDark ? 'bg-gray-700' : 'bg-gray-200')}>
                                    <Text className={cn('font-bold', isDark ? 'text-gray-300' : 'text-gray-600')}>
                                      {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                                    </Text>
                                  </View>
                                  <View className="flex-1">
                                    <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                                      {member.firstName} {member.lastName}
                                    </Text>
                                    <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                                      {member.classLevel ? getClassLabel(member.classLevel) : member.role}
                                    </Text>
                                  </View>
                                </View>
                                <View className={cn('w-6 h-6 rounded-full items-center justify-center', isSelected ? 'bg-purple-500' : isDark ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-300')}>
                                  {isSelected && <Check size={14} color="white" />}
                                </View>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                        <Pressable
                          onPress={() => setShowEditParticipantPicker(false)}
                          className={cn('py-3 items-center border-t', isDark ? 'border-gray-700' : 'border-gray-100')}
                        >
                          <Text style={{ color: theme.primary }} className="font-semibold">Done</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Animated.View>

              {/* Date Selection - Calendar Picker */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Date
                </Text>
                <Pressable
                  onPress={() => setShowEditDatePicker(!showEditDatePicker)}
                  className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <View className="flex-row items-center">
                    <CalendarIcon size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                      {format(new Date(editYear, editMonth, editDay), 'EEEE, MMMM d, yyyy')}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                {showEditDatePicker && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border p-3', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                    {/* Month Navigation */}
                    <View className="flex-row items-center justify-between mb-3">
                      <Pressable
                        onPress={() => setEditDatePickerMonth(subMonths(editDatePickerMonth, 1))}
                        className={cn('w-8 h-8 rounded-full items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      >
                        <ChevronLeft size={20} color={isDark ? '#FFFFFF' : '#111827'} />
                      </Pressable>
                      <Text className={cn('text-base font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                        {format(editDatePickerMonth, 'MMMM yyyy')}
                      </Text>
                      <Pressable
                        onPress={() => setEditDatePickerMonth(addMonths(editDatePickerMonth, 1))}
                        className={cn('w-8 h-8 rounded-full items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      >
                        <ChevronRight size={20} color={isDark ? '#FFFFFF' : '#111827'} />
                      </Pressable>
                    </View>

                    {/* Day Headers */}
                    <View className="flex-row mb-2">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <View key={index} className="w-[14.28%] items-center">
                          <Text className={cn('text-xs font-medium', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {day}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Calendar Grid */}
                    <View className="flex-row flex-wrap">
                      {(() => {
                        const monthStart = startOfMonth(editDatePickerMonth);
                        const monthEnd = endOfMonth(editDatePickerMonth);
                        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                        const startDayOfWeek = monthStart.getDay();
                        const paddingDays = Array(startDayOfWeek).fill(null);
                        const allDays = [...paddingDays, ...days];

                        return allDays.map((date, index) => {
                          if (!date) {
                            return <View key={`empty-${index}`} className="w-[14.28%] aspect-square" />;
                          }

                          const isSelectedDate =
                            date.getDate() === editDay &&
                            date.getMonth() === editMonth &&
                            date.getFullYear() === editYear;
                          const isTodayDate = isToday(date);

                          return (
                            <Pressable
                              key={date.toISOString()}
                              onPress={() => {
                                setEditDay(date.getDate());
                                setEditMonth(date.getMonth());
                                setEditYear(date.getFullYear());
                                setShowEditDatePicker(false);
                              }}
                              className="w-[14.28%] aspect-square items-center justify-center"
                            >
                              <View
                                className={cn(
                                  'w-9 h-9 rounded-full items-center justify-center',
                                  isSelectedDate && 'bg-gray-900',
                                  isTodayDate && !isSelectedDate && (isDark ? 'bg-gray-700' : 'bg-gray-200')
                                )}
                              >
                                <Text
                                  className={cn(
                                    'text-sm font-medium',
                                    isSelectedDate
                                      ? 'text-white'
                                      : isDark
                                        ? 'text-white'
                                        : 'text-gray-900'
                                  )}
                                >
                                  {format(date, 'd')}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        });
                      })()}
                    </View>
                  </View>
                )}
              </View>

              {/* Start Time */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Start Time
                </Text>
                <Pressable
                  onPress={() => setShowEditTimePicker(!showEditTimePicker)}
                  className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <View className="flex-row items-center">
                    <Clock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      {editStartTime}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                {showEditTimePicker && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {TIME_OPTIONS.map((time) => (
                        <Pressable
                          key={time}
                          onPress={() => {
                            setEditStartTime(time);
                            setShowEditTimePicker(false);
                          }}
                          className={cn(
                            'px-4 py-3 border-b',
                            isDark ? 'border-gray-700' : 'border-gray-100',
                            editStartTime === time && (isDark ? 'bg-teal-500/30' : 'bg-teal-50')
                          )}
                        >
                          <Text
                            className={cn(
                              'text-base',
                              editStartTime === time
                                ? 'font-semibold'
                                : isDark ? 'text-white' : 'text-gray-700'
                            )}
                          >
                            {time}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* End Time */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  End Time (optional)
                </Text>
                <Pressable
                  onPress={() => setShowEditEndTimePicker(!showEditEndTimePicker)}
                  className={cn('px-4 py-3 rounded-xl flex-row items-center justify-between', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <View className="flex-row items-center">
                    <Clock size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', editEndTime ? (isDark ? 'text-white' : 'text-gray-900') : (isDark ? 'text-gray-500' : 'text-gray-400'))}>
                      {editEndTime || 'No end time'}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
                {showEditEndTimePicker && (
                  <View className={cn('mt-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      <Pressable
                        onPress={() => {
                          setEditEndTime('');
                          setShowEditEndTimePicker(false);
                        }}
                        className={cn(
                          'px-4 py-3 border-b',
                          isDark ? 'border-gray-700' : 'border-gray-100',
                          editEndTime === '' && (isDark ? 'bg-teal-500/30' : 'bg-teal-50')
                        )}
                      >
                        <Text className={cn('text-base', isDark ? 'text-gray-400' : 'text-gray-500')}>
                          No end time
                        </Text>
                      </Pressable>
                      {TIME_OPTIONS.map((time) => (
                        <Pressable
                          key={time}
                          onPress={() => {
                            setEditEndTime(time);
                            setShowEditEndTimePicker(false);
                          }}
                          className={cn(
                            'px-4 py-3 border-b',
                            isDark ? 'border-gray-700' : 'border-gray-100',
                            editEndTime === time && (isDark ? 'bg-teal-500/30' : 'bg-teal-50')
                          )}
                        >
                          <Text
                            className={cn(
                              'text-base',
                              editEndTime === time
                                ? 'font-semibold'
                                : isDark ? 'text-white' : 'text-gray-700'
                            )}
                          >
                            {time}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Location */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Location
                </Text>
                <View className={cn('flex-row items-center px-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <MapPin size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <TextInput
                    className={cn('flex-1 py-3 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
                    placeholder="Enter location..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={editLocation}
                    onChangeText={setEditLocation}
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>
              </View>

              {/* Description */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Description
                </Text>
                <TextInput
                  ref={descriptionFieldRef}
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="Add details about this event..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  onFocus={() => {
                    setTimeout(() => {
                      editScrollRef.current?.scrollToEnd({ animated: true });
                    }, 300);
                  }}
                />
              </View>

              {/* Recurring Toggle */}
              <View>
                <Pressable
                  onPress={() => setEditIsRecurring(!editIsRecurring)}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-3 rounded-xl',
                    isDark ? 'bg-gray-800' : 'bg-gray-100'
                  )}
                >
                  <View className="flex-row items-center">
                    <Repeat size={20} color={editIsRecurring ? theme.primary : isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text className={cn('ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}>
                      Make Recurring
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'w-12 h-7 rounded-full p-1',
                      editIsRecurring ? 'bg-gray-900' : isDark ? 'bg-gray-600' : 'bg-gray-300'
                    )}
                  >
                    <View
                      className={cn(
                        'w-5 h-5 rounded-full bg-white',
                        editIsRecurring && 'ml-auto'
                      )}
                    />
                  </View>
                </Pressable>
              </View>

              {/* Recurring Options */}
              {editIsRecurring && (
                <Animated.View entering={FadeIn.duration(200)} className="gap-4">
                  {/* Pattern */}
                  <View>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      Repeat
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((pattern) => (
                        <Pressable
                          key={pattern}
                          onPress={() => setEditRecurringPattern(pattern)}
                          className={cn(
                            'px-4 py-2 rounded-full',
                            editRecurringPattern === pattern ? 'bg-gray-900' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                          )}
                        >
                          <Text
                            className={cn(
                              'font-medium capitalize',
                              editRecurringPattern === pattern ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                            )}
                          >
                            {pattern === 'biweekly' ? 'Bi-weekly' : pattern}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* End Date */}
                  <View>
                    <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      End Date
                    </Text>
                    <View className="flex-row gap-2">
                      {/* Month */}
                      <View className="flex-1">
                        <Pressable
                          onPress={() => { setShowEditRecurringEndMonthPicker(!showEditRecurringEndMonthPicker); setShowEditRecurringEndDayPicker(false); setShowEditRecurringEndYearPicker(false); }}
                          className={cn('px-3 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                        >
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {MONTHS[editRecurringEndMonth].substring(0, 3)}
                          </Text>
                        </Pressable>
                        <DropdownPicker
                          items={MONTHS.map((_, i) => i)}
                          selectedValue={editRecurringEndMonth}
                          onSelect={(v) => setEditRecurringEndMonth(v as number)}
                          isVisible={showEditRecurringEndMonthPicker}
                          onClose={() => setShowEditRecurringEndMonthPicker(false)}
                          formatItem={(m) => MONTHS[m as number]}
                          isDark={isDark}
                        />
                      </View>

                      {/* Day */}
                      <View className="flex-1">
                        <Pressable
                          onPress={() => { setShowEditRecurringEndDayPicker(!showEditRecurringEndDayPicker); setShowEditRecurringEndMonthPicker(false); setShowEditRecurringEndYearPicker(false); }}
                          className={cn('px-3 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                        >
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {editRecurringEndDay}
                          </Text>
                        </Pressable>
                        <DropdownPicker
                          items={Array.from({ length: daysInEditRecurringEndMonth }, (_, i) => i + 1)}
                          selectedValue={editRecurringEndDay}
                          onSelect={(v) => setEditRecurringEndDay(v as number)}
                          isVisible={showEditRecurringEndDayPicker}
                          onClose={() => setShowEditRecurringEndDayPicker(false)}
                          isDark={isDark}
                        />
                      </View>

                      {/* Year */}
                      <View className="flex-1">
                        <Pressable
                          onPress={() => { setShowEditRecurringEndYearPicker(!showEditRecurringEndYearPicker); setShowEditRecurringEndDayPicker(false); setShowEditRecurringEndMonthPicker(false); }}
                          className={cn('px-3 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                        >
                          <Text className={cn('text-base', isDark ? 'text-white' : 'text-gray-900')}>
                            {editRecurringEndYear}
                          </Text>
                        </Pressable>
                        <DropdownPicker
                          items={YEARS}
                          selectedValue={editRecurringEndYear}
                          onSelect={(v) => setEditRecurringEndYear(v as number)}
                          isVisible={showEditRecurringEndYearPicker}
                          onClose={() => setShowEditRecurringEndYearPicker(false)}
                          isDark={isDark}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Info text */}
                  <View className={cn('px-4 py-3 rounded-xl', isDark ? 'bg-gray-800/50' : 'bg-gray-50')}>
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      This will create recurring events from the selected date until the end date, keeping the same day of the week.
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilterModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowFilterModal(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Filter Events
            </Text>
            <View className="w-6" />
          </View>

          <ScrollView className="flex-1 px-5 py-4" contentContainerStyle={{ paddingBottom: 150 }}>
            <View className="gap-2">
              {/* All Events */}
              <Pressable
                onPress={() => {
                  setEventFilter('all');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'all'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  All Events
                </Text>
                {eventFilter === 'all' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* My Events */}
              <Pressable
                onPress={() => {
                  setEventFilter('my_events');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'my_events'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  My Events
                </Text>
                {eventFilter === 'my_events' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Divider */}
              <View className={cn('h-px my-2', isDark ? 'bg-gray-800' : 'bg-gray-200')} />

              <Text className={cn('text-sm font-medium mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
                By Type
              </Text>

              {/* Practice */}
              <Pressable
                onPress={() => {
                  setEventFilter('practice');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'practice'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Practice
                </Text>
                {eventFilter === 'practice' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Performance */}
              <Pressable
                onPress={() => {
                  setEventFilter('performance');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'performance'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Performance
                </Text>
                {eventFilter === 'performance' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Meeting */}
              <Pressable
                onPress={() => {
                  setEventFilter('meeting');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'meeting'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Meeting
                </Text>
                {eventFilter === 'meeting' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Workshop */}
              <Pressable
                onPress={() => {
                  setEventFilter('workshop');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'workshop'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Workshop
                </Text>
                {eventFilter === 'workshop' && <Check size={20} color={theme.primary} />}
              </Pressable>

              {/* Other */}
              <Pressable
                onPress={() => {
                  setEventFilter('other');
                  setShowFilterModal(false);
                }}
                className={cn(
                  'flex-row items-center justify-between p-4 rounded-xl',
                  eventFilter === 'other'
                    ? isDark ? 'bg-gray-800' : 'bg-gray-100'
                    : isDark ? 'bg-gray-900' : 'bg-gray-50'
                )}
              >
                <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Other
                </Text>
                {eventFilter === 'other' && <Check size={20} color={theme.primary} />}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export default function EventsScreen() {
  return (
    <ErrorBoundary>
      <EventsContent />
    </ErrorBoundary>
  );
}
