import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Linking, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import BackButton from '@/components/BackButton';
import {
  Search,
  LayoutDashboard,
  MessageCircle,
  Calendar,
  Video,
  Users,
  Wallet,
  FileText,
  Settings,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BookOpen,
  Star,
  Shield,
  Bell,
  UserPlus,
  CheckCircle,
  Clock,
  Send,
  Image as ImageIcon,
  BarChart3,
  Vote,
  Hash,
  Lock,
  Palette,
  Tag,
  GraduationCap,
  Download,
  Share2,
  X,
  CircleDot,
  AlertCircle,
  HelpCircle,
  Play,
  ClipboardCheck,
  Zap,
  Baby,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { useTour } from '@/lib/tourContext';

interface GuideStep {
  step: number;
  title: string;
  description: string;
}

interface GuideSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  overview: string;
  guides: {
    title: string;
    steps: GuideStep[];
    forTeachers?: boolean;
  }[];
}

interface QuickTip {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

// ─── Interactive Tour Buttons Config ─────────────────────────────────────────

const TOUR_BUTTONS = [
  {
    id: 'dashboard',
    label: 'Dashboard Guide',
    description: 'Stats, events & quick actions',
    icon: (color: string) => <LayoutDashboard size={22} color={color} />,
  },
  {
    id: 'members',
    label: 'Members Guide',
    description: 'View, approve & manage dancers',
    icon: (color: string) => <Users size={22} color={color} />,
  },
  {
    id: 'events',
    label: 'Events Guide',
    description: 'Calendar, RSVP & attendance',
    icon: (color: string) => <Calendar size={22} color={color} />,
  },
  {
    id: 'chat',
    label: 'Chat Guide',
    description: 'Channels, messages & polls',
    icon: (color: string) => <MessageCircle size={22} color={color} />,
  },
  {
    id: 'financials',
    label: 'Financials Guide',
    description: 'Dues, payments & expenses',
    icon: (color: string) => <Wallet size={22} color={color} />,
  },
  {
    id: 'videos',
    label: 'Videos Guide',
    description: 'Library, search & uploads',
    icon: (color: string) => <Video size={22} color={color} />,
  },
  {
    id: 'waivers',
    label: 'Waivers Guide',
    description: 'Documents & signatures',
    icon: (color: string) => <FileText size={22} color={color} />,
  },
  {
    id: 'attendance',
    label: 'Attendance Guide',
    description: 'Mark & track attendance',
    icon: (color: string) => <ClipboardCheck size={22} color={color} />,
  },
] as const;

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HelpCenterScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  // ── Tour state ─────────────────────────────────────────────────────────────
  const { startFeatureGuide } = useTour();

  const seenGuides = useAppStore((s) => s.seenGuides);

  const startGuide = useCallback((guideId: string) => {
    startFeatureGuide(guideId);
  }, [startFeatureGuide]);

  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  const isKumu = useAppStore((s) => s.isKumu);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;
  const isTeacher = isKumu();

  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  const quickTips: QuickTip[] = [
    {
      id: '1',
      title: 'Navigate with Tabs',
      description: 'Use the bottom tabs to switch between Dashboard, Chat, Events, Videos, and More.',
      icon: <LayoutDashboard size={20} color={theme.primary} />,
    },
    {
      id: '2',
      title: 'Stay Connected',
      description: 'Check the Chat tab for messages, announcements, and group discussions.',
      icon: <MessageCircle size={20} color={theme.primary} />,
    },
    {
      id: '3',
      title: 'Never Miss Events',
      description: 'RSVP to events and track your attendance history in the Events tab.',
      icon: <Calendar size={20} color={theme.primary} />,
    },
  ];

  const guideSections: GuideSection[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: <LayoutDashboard size={22} color={theme.primary} />,
      description: 'Your home base with quick access to everything',
      overview: 'The Dashboard is your central hub showing key stats, upcoming events, and quick actions. It gives you an at-a-glance view of what\'s happening in your halau.',
      guides: [
        {
          title: 'How to View Your Dashboard Stats',
          steps: [
            { step: 1, title: 'Open the App', description: 'Launch HalauHub. The Dashboard is the first screen you see after logging in.' },
            { step: 2, title: 'View Quick Stats', description: 'At the top, you\'ll see cards showing total dancers, upcoming events, and financial summaries (if applicable to your role).' },
            { step: 3, title: 'Tap for Details', description: 'Tap any stat card to navigate directly to that section for more information.' },
          ],
        },
        {
          title: 'How to Check Upcoming Events',
          steps: [
            { step: 1, title: 'Scroll Down', description: 'On the Dashboard, scroll down past the stat cards to see the "Upcoming Events" section.' },
            { step: 2, title: 'View Event Details', description: 'Each event shows the date, time, and type. Performances are highlighted separately.' },
            { step: 3, title: 'Tap to See More', description: 'Tap any event to view full details, location, and RSVP options.' },
          ],
        },
        {
          title: 'How to Use Quick Actions',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Find Quick Actions', description: 'Teachers see a "Quick Actions" section with common tasks like creating events or marking attendance.' },
            { step: 2, title: 'Create Event', description: 'Tap "Create Event" to quickly add a new practice, performance, or meeting.' },
            { step: 3, title: 'Mark Attendance', description: 'Tap "Mark Attendance" to record who attended a recent event.' },
          ],
        },
      ],
    },
    {
      id: 'chat',
      title: 'Messages & Chat',
      icon: <MessageCircle size={22} color={theme.primary} />,
      description: 'Stay connected with your group',
      overview: 'The Chat feature lets you communicate with your halau through channels. Share announcements, discuss events, and stay connected with your dance family.',
      guides: [
        {
          title: 'How to Send a Message',
          steps: [
            { step: 1, title: 'Go to Chat Tab', description: 'Tap the "Chat" icon in the bottom navigation bar.' },
            { step: 2, title: 'Select a Channel', description: 'Choose the channel you want to message in (e.g., General, Announcements).' },
            { step: 3, title: 'Type Your Message', description: 'Tap the text input at the bottom of the screen and type your message.' },
            { step: 4, title: 'Send', description: 'Tap the send button (arrow icon) to post your message.' },
          ],
        },
        {
          title: 'How to Share Images in Chat',
          steps: [
            { step: 1, title: 'Open a Channel', description: 'Navigate to the Chat tab and select your desired channel.' },
            { step: 2, title: 'Tap the Image Icon', description: 'Next to the message input, tap the image/camera icon.' },
            { step: 3, title: 'Select Your Photo', description: 'Choose a photo from your gallery or take a new one.' },
            { step: 4, title: 'Add Caption (Optional)', description: 'Type a message to accompany your image if desired.' },
            { step: 5, title: 'Send', description: 'Tap send to share the image with the channel.' },
          ],
        },
        {
          title: 'How to Create a Poll',
          steps: [
            { step: 1, title: 'Open a Channel', description: 'Go to the Chat tab and select the channel where you want to create a poll.' },
            { step: 2, title: 'Tap the Poll Icon', description: 'Look for the poll/vote icon near the message input and tap it.' },
            { step: 3, title: 'Enter Your Question', description: 'Type the question you want to ask (e.g., "What day works best for extra practice?").' },
            { step: 4, title: 'Add Options', description: 'Enter at least 2 options for people to choose from. Tap "Add Option" for more choices.' },
            { step: 5, title: 'Create Poll', description: 'Tap "Create" to post the poll. Members can then vote on their preferred option.' },
          ],
        },
        {
          title: 'How to Create a New Channel',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Chat Tab', description: 'Open the Chat section from the bottom navigation.' },
            { step: 2, title: 'Tap the Plus Button', description: 'Look for the "+" or "New Channel" button, usually at the top or bottom of the channel list.' },
            { step: 3, title: 'Enter Channel Name', description: 'Give your channel a descriptive name (e.g., "Advanced Class", "Performance Team").' },
            { step: 4, title: 'Set Privacy (Optional)', description: 'Choose whether the channel is visible to all members or specific groups.' },
            { step: 5, title: 'Create', description: 'Tap "Create" to add the new channel. You can now start posting messages.' },
          ],
        },
        {
          title: 'How to React to Messages',
          steps: [
            { step: 1, title: 'Find the Message', description: 'Scroll through the chat to find the message you want to react to.' },
            { step: 2, title: 'Long Press', description: 'Press and hold on the message until a menu appears.' },
            { step: 3, title: 'Select an Emoji', description: 'Choose from the available emoji reactions to express your response.' },
            { step: 4, title: 'View Reactions', description: 'Reactions appear below the message. Tap them to see who reacted.' },
          ],
        },
      ],
    },
    {
      id: 'events',
      title: 'Events & RSVPs',
      icon: <Calendar size={22} color={theme.primary} />,
      description: 'Manage classes, performances, and gatherings',
      overview: 'The Events tab helps you stay organized with all halau activities. View upcoming practices, performances, and meetings. RSVP to let teachers know you\'re coming.',
      guides: [
        {
          title: 'How to View Events',
          steps: [
            { step: 1, title: 'Open Events Tab', description: 'Tap "Events" in the bottom navigation bar.' },
            { step: 2, title: 'Choose Your View', description: 'Toggle between "Calendar" view (see events on a calendar) or "List" view (see events in a list).' },
            { step: 3, title: 'Browse Events', description: 'Scroll through to see all upcoming events. Each shows the date, time, and event type.' },
            { step: 4, title: 'Tap for Details', description: 'Tap any event to see full details including location, description, and who\'s attending.' },
          ],
        },
        {
          title: 'How to RSVP to an Event',
          steps: [
            { step: 1, title: 'Find the Event', description: 'Go to the Events tab and tap on the event you want to RSVP to.' },
            { step: 2, title: 'View Event Details', description: 'Review the event information including date, time, and location.' },
            { step: 3, title: 'Choose Your Response', description: 'Tap one of the RSVP options: "Going", "Maybe", or "Can\'t Go".' },
            { step: 4, title: 'Confirmation', description: 'Your response is saved automatically. You can change it anytime before the event.' },
          ],
        },
        {
          title: 'How to Create an Event',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Events Tab', description: 'Open the Events section from the bottom navigation.' },
            { step: 2, title: 'Tap the Plus Button', description: 'Look for the floating "+" button and tap it to create a new event.' },
            { step: 3, title: 'Enter Event Details', description: 'Fill in the event name, type (practice, performance, meeting, etc.), and description.' },
            { step: 4, title: 'Set Date and Time', description: 'Select the date and choose start time. Optionally set an end time.' },
            { step: 5, title: 'Add Location', description: 'Enter the location where the event will take place.' },
            { step: 6, title: 'Assign Participants (Optional)', description: 'For performances, select which members are assigned to participate.' },
            { step: 7, title: 'Save', description: 'Tap "Create" or "Save" to add the event. Members will be able to see and RSVP.' },
          ],
        },
        {
          title: 'How to Set Up Recurring Events',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Start Creating Event', description: 'Tap the "+" button in the Events tab to begin creating a new event.' },
            { step: 2, title: 'Fill Basic Details', description: 'Enter the event name, type, time, and location as usual.' },
            { step: 3, title: 'Enable Recurring', description: 'Look for the "Recurring" toggle and turn it on.' },
            { step: 4, title: 'Choose Pattern', description: 'Select how often the event repeats: Daily, Weekly, or Monthly.' },
            { step: 5, title: 'Set End Date', description: 'Choose when the recurring series should end (e.g., after 3 months).' },
            { step: 6, title: 'Create Series', description: 'Tap "Create" to generate all the recurring events at once.' },
          ],
        },
        {
          title: 'How to Take Attendance',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Find the Event', description: 'Go to Events and tap on the event you want to take attendance for.' },
            { step: 2, title: 'Tap Attendance', description: 'Look for the "Take Attendance" or "Mark Attendance" button.' },
            { step: 3, title: 'Mark Present/Absent', description: 'Go through the member list and tap to mark each person as present or absent.' },
            { step: 4, title: 'Add Notes (Optional)', description: 'You can add notes for late arrivals or other attendance details.' },
            { step: 5, title: 'Save', description: 'Tap "Save" to record the attendance. This updates member attendance records.' },
          ],
        },
      ],
    },
    {
      id: 'videos',
      title: 'Video Library',
      icon: <Video size={22} color={theme.primary} />,
      description: 'Access practice and performance videos',
      overview: 'The Video Library stores all your halau\'s practice videos and performance recordings. Use it to learn choreography, review performances, and improve your skills.',
      guides: [
        {
          title: 'How to Watch Videos',
          steps: [
            { step: 1, title: 'Open Videos Tab', description: 'Tap "Videos" in the bottom navigation bar.' },
            { step: 2, title: 'Browse Categories', description: 'Videos are organized by categories (e.g., Practice, Performances, Tutorials).' },
            { step: 3, title: 'Select a Video', description: 'Tap on any video thumbnail to open the video player.' },
            { step: 4, title: 'Control Playback', description: 'Use the play/pause button, scrub through the timeline, or adjust volume.' },
          ],
        },
        {
          title: 'How to Search for Videos',
          steps: [
            { step: 1, title: 'Go to Videos Tab', description: 'Navigate to the Video Library section.' },
            { step: 2, title: 'Tap Search', description: 'Look for the search icon or search bar at the top of the screen.' },
            { step: 3, title: 'Enter Keywords', description: 'Type the name of the dance, song, or video you\'re looking for.' },
            { step: 4, title: 'View Results', description: 'Matching videos will appear. Tap any result to watch.' },
          ],
        },
        {
          title: 'How to Upload a Video',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Videos Tab', description: 'Open the Video Library from the bottom navigation.' },
            { step: 2, title: 'Tap Upload/Add', description: 'Look for the "+" or "Upload" button to add a new video.' },
            { step: 3, title: 'Select Video', description: 'Choose a video from your device\'s gallery or record a new one.' },
            { step: 4, title: 'Add Details', description: 'Enter a title, description, and select a category for the video.' },
            { step: 5, title: 'Set Visibility', description: 'Choose who can view the video (all members, specific classes, etc.).' },
            { step: 6, title: 'Upload', description: 'Tap "Upload" and wait for the video to process. It will appear in the library when ready.' },
          ],
        },
      ],
    },
    {
      id: 'members',
      title: 'Members',
      icon: <Users size={22} color={theme.primary} />,
      description: 'View and manage group members',
      overview: 'The Members section shows everyone in your halau — teachers, admins, students, guardians, and their keiki (children). Guardians have their linked keiki nested underneath their card. Teachers can manage requests and assignments.',
      guides: [
        {
          title: 'How to View Member Profiles',
          steps: [
            { step: 1, title: 'Go to Members', description: 'Tap on "More" in the bottom tab, then select "Members" from the menu.' },
            { step: 2, title: 'Browse the List', description: 'Scroll through all members. Teachers, admins, students, and guardians each have their own section.' },
            { step: 3, title: 'Tap a Member', description: 'Select any member to view their full profile.' },
            { step: 4, title: 'View Details', description: 'See their contact information, class level, attendance history, and more.' },
          ],
        },
        {
          title: 'How Guardians & Keiki Appear',
          steps: [
            { step: 1, title: 'Go to Members', description: 'Navigate to More > Members.' },
            { step: 2, title: 'Find a Guardian', description: 'Guardians appear in the list with a "Guardian" badge and a keiki count.' },
            { step: 3, title: 'Tap to Expand', description: 'Tap the guardian card to expand it and see their linked keiki (children) nested underneath.' },
            { step: 4, title: 'View Keiki Profiles', description: 'Each keiki appears as a sub-card under their guardian. Tap them to view their individual profile.' },
          ],
        },
        {
          title: 'How to Add a Keiki (Child) to Your Account',
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Find My Keiki Section', description: 'Look for "My Keiki" or "Manage Children" option.' },
            { step: 3, title: 'Tap Add Keiki', description: 'Select the option to add a new child to your account.' },
            { step: 4, title: 'Enter Details', description: 'Fill in your child\'s name and any other required information.' },
            { step: 5, title: 'Save', description: 'Tap "Save" to add your keiki. They\'ll appear nested under your guardian card.' },
          ],
        },
        {
          title: 'How to Share the Invite Code',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation bar.' },
            { step: 2, title: 'Find School Invite Code', description: 'Look for "School Invite Code" in the settings or management section.' },
            { step: 3, title: 'Copy or Share', description: 'Tap to copy the code or use the share button to send it via text, email, or social media.' },
            { step: 4, title: 'New Members Use Code', description: 'When new members or guardians sign up, they enter this code to join your halau.' },
          ],
        },
        {
          title: 'How to Approve Pending Members',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Check Dashboard', description: 'On your Dashboard, look for a notification about pending member requests.' },
            { step: 2, title: 'Tap to Review', description: 'Tap the pending members notification or go to More > Members > Pending.' },
            { step: 3, title: 'Review Each Request', description: 'See the person\'s name and information they provided when signing up.' },
            { step: 4, title: 'Approve or Decline', description: 'Tap "Approve" to add them to your halau, or "Decline" to reject the request.' },
            { step: 5, title: 'Set Class Level', description: 'After approving, you can set their class level.' },
          ],
        },
        {
          title: 'How to Set Class Levels',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Members', description: 'Navigate to the Members section through the More tab.' },
            { step: 2, title: 'Select a Member', description: 'Tap on the member you want to assign a class level to.' },
            { step: 3, title: 'Tap Edit or Class Level', description: 'Look for an edit button or the class level field.' },
            { step: 4, title: 'Choose Level', description: 'Select the appropriate class level from the dropdown (e.g., Beginner, Intermediate, Advanced).' },
            { step: 5, title: 'Save', description: 'Tap "Save" to update the member\'s class level.' },
          ],
        },
      ],
    },
    {
      id: 'guardians',
      title: 'Guardians & Keiki',
      icon: <Baby size={22} color={theme.primary} />,
      description: 'How parent accounts and children are linked',
      overview: 'Guardians (parents or caregivers) have their own account and can have one or more keiki (children) linked under them. Keiki do not have separate logins — they are managed through their guardian\'s account and appear nested under the guardian card throughout the app.',
      guides: [
        {
          title: 'Understanding the Guardian Role',
          steps: [
            { step: 1, title: 'Guardian Account', description: 'A guardian is a parent or caregiver who has joined your halau. They use their own email and password to log in.' },
            { step: 2, title: 'Linked Keiki', description: 'Each guardian can have one or more keiki (children) linked to their account. Keiki are shown nested under the guardian everywhere in the app.' },
            { step: 3, title: 'Shared Email', description: 'Keiki are associated with their guardian\'s email address, keeping the family unit together in the system.' },
            { step: 4, title: 'Enrollment', description: 'Teachers enroll keiki into classes. The guardian can see their keiki\'s events, attendance, and dues.' },
          ],
        },
        {
          title: 'How to Find a Guardian\'s Keiki',
          steps: [
            { step: 1, title: 'Go to Members', description: 'Tap More > Members.' },
            { step: 2, title: 'Find the Guardian', description: 'Scroll to the Guardians section. Each guardian card shows a small keiki count badge.' },
            { step: 3, title: 'Expand the Card', description: 'Tap the guardian\'s card to expand it. Their keiki appear as sub-cards underneath.' },
            { step: 4, title: 'Tap a Keiki', description: 'Tap any keiki sub-card to open their individual profile with class, attendance, and dues details.' },
          ],
        },
        {
          title: 'How Keiki Are Added',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Guardian Joins First', description: 'The guardian signs up using the school\'s invite code and completes their own profile.' },
            { step: 2, title: 'Add Keiki via More Tab', description: 'The guardian goes to More > My Keiki and taps "Add Keiki" to register their child.' },
            { step: 3, title: 'Teacher Review', description: 'The keiki appears as a pending member. Review and approve them in the Pending tab.' },
            { step: 4, title: 'Assign to Class', description: 'After approval, assign the keiki to a class level. They\'ll be visible under their guardian from then on.' },
          ],
        },
      ],
    },
    {
      id: 'financials',
      title: 'Financials',
      icon: <Wallet size={22} color={theme.primary} />,
      description: 'Track dues, payments, and expenses',
      overview: 'The Financials section helps manage money matters. Members can view their dues and payment status. Teachers can create dues, record payments, and track expenses.',
      guides: [
        {
          title: 'How to View Your Dues',
          steps: [
            { step: 1, title: 'Go to Financials', description: 'Tap "More" in the bottom tab, then select "Financials".' },
            { step: 2, title: 'View Dues Tab', description: 'The Dues tab shows all dues assigned to you.' },
            { step: 3, title: 'Check Status', description: 'Each due shows the amount, due date, and status (Paid, Pending, Overdue).' },
            { step: 4, title: 'View Details', description: 'Tap any due to see more details including payment history.' },
          ],
        },
        {
          title: 'How to Submit a Payment Record',
          steps: [
            { step: 1, title: 'Go to Financials', description: 'Navigate to the Financials section through the More tab.' },
            { step: 2, title: 'Find Your Due', description: 'Locate the due you want to record a payment for.' },
            { step: 3, title: 'Tap Record Payment', description: 'Select the option to record or submit a payment.' },
            { step: 4, title: 'Enter Payment Details', description: 'Choose the payment method (cash, check, Venmo, etc.) and enter the amount.' },
            { step: 5, title: 'Add Proof (Optional)', description: 'Attach a photo of a receipt or screenshot of the transaction if required.' },
            { step: 6, title: 'Submit', description: 'Tap "Submit" to send the payment record for teacher approval.' },
          ],
        },
        {
          title: 'How to Create Dues',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Financials', description: 'Open Financials from the More tab.' },
            { step: 2, title: 'Tap Set Up Payments', description: 'Look for "Set Up Payments" or "Manage Dues" option.' },
            { step: 3, title: 'Create New Dues Template', description: 'Tap the "+" button to create a new dues template.' },
            { step: 4, title: 'Enter Details', description: 'Set the name, amount, frequency (monthly, annually), and category.' },
            { step: 5, title: 'Save Template', description: 'Tap "Save" to create the dues template.' },
          ],
        },
        {
          title: 'How to Assign Dues to Members',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Set Up Payments', description: 'Navigate to Financials > Set Up Payments.' },
            { step: 2, title: 'Find the Dues Template', description: 'Locate the dues you want to assign.' },
            { step: 3, title: 'Tap Assign', description: 'Press the "Assign" button next to the dues template.' },
            { step: 4, title: 'Set Due Date', description: 'Choose when the payment is due.' },
            { step: 5, title: 'Select Recipients', description: 'Choose to assign by class level (all beginners, etc.) or select individual members.' },
            { step: 6, title: 'Enable Recurring (Optional)', description: 'Turn on recurring if this due should repeat monthly.' },
            { step: 7, title: 'Assign', description: 'Tap "Assign" to create the dues for all selected members.' },
          ],
        },
        {
          title: 'How to Record a Payment',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Financials', description: 'Open the Financials section.' },
            { step: 2, title: 'Find Pending Dues', description: 'Look at the Dues tab to see payments that are pending.' },
            { step: 3, title: 'Select a Due', description: 'Tap on a member\'s pending due.' },
            { step: 4, title: 'Tap Record Payment', description: 'Select the option to record a payment.' },
            { step: 5, title: 'Enter Amount', description: 'Enter the amount received and payment method.' },
            { step: 6, title: 'Confirm', description: 'Tap "Confirm" to mark the payment as received.' },
          ],
        },
        {
          title: 'How to Request Reimbursement',
          steps: [
            { step: 1, title: 'Go to Financials', description: 'Navigate to the Financials section.' },
            { step: 2, title: 'Go to Expenses Tab', description: 'Switch to the "Expenses" tab.' },
            { step: 3, title: 'Tap Request Reimbursement', description: 'Look for the button to submit a reimbursement request.' },
            { step: 4, title: 'Enter Details', description: 'Describe what you purchased and enter the amount.' },
            { step: 5, title: 'Attach Receipt', description: 'Take a photo of or upload your receipt as proof.' },
            { step: 6, title: 'Submit', description: 'Tap "Submit" to send the request for approval.' },
          ],
        },
      ],
    },
    {
      id: 'shows',
      title: 'Shows & Performances',
      icon: <Star size={22} color={theme.primary} />,
      description: 'Manage performance opportunities',
      overview: 'The Shows section tracks all performance opportunities. See upcoming shows, manage participants, and keep everyone organized for performance days.',
      guides: [
        {
          title: 'How to View Upcoming Shows',
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Select Shows', description: 'Tap on "Shows" to open the shows management screen.' },
            { step: 3, title: 'Browse Shows', description: 'See all upcoming performances with dates, times, and locations.' },
            { step: 4, title: 'Tap for Details', description: 'Select any show to see full details including participant list and requirements.' },
          ],
        },
        {
          title: 'How to Create a Show',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Shows', description: 'Navigate to More > Shows.' },
            { step: 2, title: 'Tap Add Show', description: 'Press the "+" button to create a new show.' },
            { step: 3, title: 'Enter Show Details', description: 'Fill in the show name, date, time, and venue.' },
            { step: 4, title: 'Add Description', description: 'Include any important details about the performance.' },
            { step: 5, title: 'Select Performers', description: 'Choose which members will be performing at this show.' },
            { step: 6, title: 'Save', description: 'Tap "Create" to add the show. Assigned members will be notified.' },
          ],
        },
      ],
    },
    {
      id: 'waivers',
      title: 'Waivers & Documents',
      icon: <FileText size={22} color={theme.primary} />,
      description: 'Manage important documents',
      overview: 'The Waivers section contains all required documents for your halau. Sign liability waivers, view registration forms, and keep your paperwork up to date.',
      guides: [
        {
          title: 'How to View and Complete Waivers',
          steps: [
            { step: 1, title: 'Go to Waivers', description: 'Tap "More" then select "Waivers" from the menu.' },
            { step: 2, title: 'View Required Documents', description: 'See all waivers and forms that need your attention.' },
            { step: 3, title: 'Check Status', description: 'Each document shows if it\'s "Pending", "Signed", or "Expired".' },
            { step: 4, title: 'Complete Pending Items', description: 'Tap any pending waiver to view and complete it.' },
          ],
        },
        {
          title: 'How to Sign an In-App Waiver',
          steps: [
            { step: 1, title: 'Open the Waiver', description: 'From the Waivers screen, tap on a pending waiver.' },
            { step: 2, title: 'Read the Document', description: 'Carefully read through the entire waiver content.' },
            { step: 3, title: 'Scroll to Bottom', description: 'Scroll down to find the signature section.' },
            { step: 4, title: 'Type Your Name', description: 'Enter your full legal name in the signature field.' },
            { step: 5, title: 'Submit', description: 'Tap "Sign" or "Submit" to complete the waiver. Your signed waiver is now recorded.' },
          ],
        },
        {
          title: 'How to Open External Waiver Forms',
          steps: [
            { step: 1, title: 'Find the Form', description: 'In the Waivers section, look for forms marked as "Online Form".' },
            { step: 2, title: 'Tap to Open', description: 'Tap the waiver card to open the external link.' },
            { step: 3, title: 'Complete in Browser', description: 'The form will open in your web browser. Fill it out completely.' },
            { step: 4, title: 'Submit the Form', description: 'Follow the form\'s instructions to submit. The halau will receive your submission.' },
          ],
        },
        {
          title: 'How to Add Waiver Forms',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to Waivers', description: 'Navigate to More > Waivers.' },
            { step: 2, title: 'Tap Add Button', description: 'Press the "+" floating button to add a new waiver.' },
            { step: 3, title: 'Choose Type', description: 'Select "Online Link" for web forms (Google Forms, DocuSign) or "Upload File" for PDFs.' },
            { step: 4, title: 'Enter Details', description: 'Add a title and description explaining what the waiver is for.' },
            { step: 5, title: 'Add URL or File', description: 'Paste the form URL or select a document from your device.' },
            { step: 6, title: 'Save', description: 'Tap the checkmark to add the waiver. Members can now access it.' },
          ],
        },
      ],
    },
    {
      id: 'settings',
      title: 'Settings & Customization',
      icon: <Settings size={22} color={theme.primary} />,
      description: 'Personalize your experience',
      overview: 'Customize HalauHub to fit your preferences. Update your profile, manage notifications, and (for teachers) customize your halau\'s appearance and settings.',
      guides: [
        {
          title: 'How to Update Your Profile',
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Tap Your Profile', description: 'Select "Profile" or tap on your name/photo at the top.' },
            { step: 3, title: 'Edit Information', description: 'Update your name, email, phone number, or other details.' },
            { step: 4, title: 'Change Profile Photo', description: 'Tap your photo to upload a new one from your gallery.' },
            { step: 5, title: 'Save Changes', description: 'Tap "Save" to update your profile.' },
          ],
        },
        {
          title: 'How to Toggle Dark Mode',
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Find Appearance Option', description: 'Look for "Appearance" or "Dark Mode" setting.' },
            { step: 3, title: 'Toggle Dark Mode', description: 'Tap to switch between light and dark themes.' },
            { step: 4, title: 'Automatic (Optional)', description: 'Some devices support automatic switching based on system settings.' },
          ],
        },
        {
          title: 'How to Customize School Branding',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Select School Branding', description: 'Find and tap on "School Branding" in the settings.' },
            { step: 3, title: 'Upload Logo', description: 'Tap to upload your halau\'s logo image.' },
            { step: 4, title: 'Choose Theme Colors', description: 'Select a color theme that matches your halau\'s identity.' },
            { step: 5, title: 'Preview Changes', description: 'See how your changes look throughout the app.' },
            { step: 6, title: 'Save', description: 'Tap "Save" to apply the branding to your halau.' },
          ],
        },
        {
          title: 'How to Manage Class Levels',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Select Class Levels', description: 'Find and tap on "Class Levels" in the settings.' },
            { step: 3, title: 'View Existing Levels', description: 'See all current class levels (Beginner, Intermediate, etc.).' },
            { step: 4, title: 'Add New Level', description: 'Tap "Add" to create a custom class level.' },
            { step: 5, title: 'Edit or Delete', description: 'Tap on any level to edit its name or remove it.' },
            { step: 6, title: 'Save', description: 'Changes are saved automatically.' },
          ],
        },
        {
          title: 'How to Manage Permissions',
          forTeachers: true,
          steps: [
            { step: 1, title: 'Go to More Tab', description: 'Tap "More" in the bottom navigation.' },
            { step: 2, title: 'Select Permissions', description: 'Find and tap on "Permissions" in the settings.' },
            { step: 3, title: 'Choose a Role', description: 'Select which role\'s permissions you want to modify (Admin, Student, Guardian).' },
            { step: 4, title: 'Toggle Permissions', description: 'Turn individual permissions on or off for that role.' },
            { step: 5, title: 'Save Changes', description: 'Tap "Save" to apply the permission changes.' },
          ],
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: <HelpCircle size={22} color={theme.primary} />,
      description: 'Common issues and solutions',
      overview: 'Having problems? This section covers common issues and how to fix them. From login problems to missing content, find solutions here.',
      guides: [
        {
          title: 'I Can\'t Log In',
          steps: [
            { step: 1, title: 'Check Your Email', description: 'Make sure you\'re using the correct email address you signed up with.' },
            { step: 2, title: 'Reset Password', description: 'Tap "Forgot Password" on the login screen to reset your password.' },
            { step: 3, title: 'Check Your Email', description: 'Look for the password reset email (check spam folder too).' },
            { step: 4, title: 'Try Again', description: 'Use your new password to log in.' },
            { step: 5, title: 'Contact Support', description: 'If still having issues, reach out to your halau administrator.' },
          ],
        },
        {
          title: 'I\'m Not Seeing Events or Content',
          steps: [
            { step: 1, title: 'Pull to Refresh', description: 'Swipe down on the screen to refresh the content.' },
            { step: 2, title: 'Check Your Class Level', description: 'Some content may be restricted to certain class levels. Verify your assignment.' },
            { step: 3, title: 'Wait for Approval', description: 'If you\'re a new member, you may need teacher approval before seeing all content.' },
            { step: 4, title: 'Check Internet Connection', description: 'Ensure you have a stable internet connection.' },
            { step: 5, title: 'Restart the App', description: 'Close and reopen HalauHub to refresh your data.' },
          ],
        },
        {
          title: 'App is Running Slowly',
          steps: [
            { step: 1, title: 'Close Other Apps', description: 'Close any apps running in the background on your device.' },
            { step: 2, title: 'Check Storage', description: 'Ensure your device has enough free storage space.' },
            { step: 3, title: 'Restart Your Device', description: 'Turn your phone off and back on.' },
            { step: 4, title: 'Update the App', description: 'Check the App Store for any available updates.' },
            { step: 5, title: 'Check WiFi', description: 'If on WiFi, try switching to cellular data or vice versa.' },
          ],
        },
        {
          title: 'Notifications Aren\'t Working',
          steps: [
            { step: 1, title: 'Check Device Settings', description: 'Go to your phone\'s Settings > Notifications > HalauHub.' },
            { step: 2, title: 'Enable Notifications', description: 'Make sure notifications are turned on for the app.' },
            { step: 3, title: 'Check In-App Settings', description: 'In HalauHub, go to More > Settings and check notification preferences.' },
            { step: 4, title: 'Enable All Types', description: 'Make sure the notification types you want are enabled.' },
            { step: 5, title: 'Restart App', description: 'Close and reopen the app to apply changes.' },
          ],
        },
        {
          title: 'How to Contact Support',
          steps: [
            { step: 1, title: 'In-App Help', description: 'Go to More > Help Center for guides and information.' },
            { step: 2, title: 'Contact Your Teacher', description: 'For halau-specific issues, reach out to your teacher or administrator.' },
            { step: 3, title: 'Support HalauHub', description: 'Tap "Support HalauHub" in the More tab to visit our support page.' },
            { step: 4, title: 'Describe Your Issue', description: 'When reporting problems, include what you were doing when the issue occurred.' },
          ],
        },
      ],
    },
  ];

  const filteredSections = guideSections.filter((section) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      section.title.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query) ||
      section.overview.toLowerCase().includes(query) ||
      section.guides.some((guide) =>
        guide.title.toLowerCase().includes(query) ||
        guide.steps.some((step) =>
          step.title.toLowerCase().includes(query) ||
          step.description.toLowerCase().includes(query)
        )
      )
    );
  });

  const toggleSection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSection(expandedSection === id ? null : id);
    setExpandedGuide(null);
  };

  const toggleGuide = (guideId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedGuide(expandedGuide === guideId ? null : guideId);
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View
        className={cn('border-b', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200')}
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <BackButton />
          <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Help Center
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <KeyboardAwareScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
      >
        {/* Hero Section */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="px-5 py-6"
          style={{ backgroundColor: theme.primary }}
        >
          <View className="flex-row items-center mb-3">
            <BookOpen size={28} color="white" />
            <Text className="text-white text-xl font-bold ml-3">Smart Guide</Text>
          </View>
          <Text className="text-white/90 text-base leading-6">
            Step-by-step instructions for everything in HalauHub. Tap any section below to learn more.
          </Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="px-4 py-4"
        >
          <View
            className={cn(
              'flex-row items-center rounded-xl px-4 py-3',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: isDark ? 0.5 : 0.2,
              shadowRadius: 6,
              elevation: isDark ? 6 : 5,
            }}
          >
            <Search size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <TextInput
              placeholder="Search for help..."
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <X size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Quick Tips */}
        {!searchQuery && (
          <>
          {/* ── Interactive Tours Section ─────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(130).duration(400)} className="px-4 mb-5">
            {/* Section header */}
            <View className="flex-row items-center mb-3 px-1">
              <View
                className="w-6 h-6 rounded-md items-center justify-center mr-2"
                style={{ backgroundColor: `${theme.primary}20` }}
              >
                <Zap size={14} color={theme.primary} />
              </View>
              <Text className={cn('text-sm font-semibold tracking-wide', isDark ? 'text-gray-400' : 'text-gray-500')}>
                INTERACTIVE TOURS
              </Text>
            </View>

            {/* 2-column grid */}
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
              {TOUR_BUTTONS.map((btn, i) => (
                <Animated.View
                  key={btn.id}
                  entering={FadeInDown.delay(140 + i * 35).duration(350)}
                  style={{ width: '47.5%' }}
                >
                  <Pressable
                    onPress={() => startGuide(btn.id)}
                    className={cn(
                      'rounded-2xl p-4 overflow-hidden',
                      isDark ? 'bg-gray-900' : 'bg-white'
                    )}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.75 : 1,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                      shadowColor: theme.primary,
                      shadowOffset: { width: 0, height: 3 },
                      shadowOpacity: isDark ? 0.25 : 0.12,
                      shadowRadius: 8,
                      elevation: 4,
                    })}
                  >
                    {/* Icon */}
                    <View
                      className="w-10 h-10 rounded-xl items-center justify-center mb-3"
                      style={{ backgroundColor: `${theme.primary}18` }}
                    >
                      {btn.icon(theme.primary)}
                    </View>

                    {/* Label row with optional New badge */}
                    <View className="flex-row items-center mb-0.5">
                      <Text
                        className={cn('font-semibold text-sm flex-1', isDark ? 'text-white' : 'text-gray-900')}
                        numberOfLines={1}
                      >
                        {btn.label}
                      </Text>
                      {!seenGuides.includes(btn.id) && (
                        <View
                          className="px-1.5 py-0.5 rounded-full ml-1"
                          style={{ backgroundColor: '#F43F5E' }}
                        >
                          <Text className="text-white text-[9px] font-bold">NEW</Text>
                        </View>
                      )}
                    </View>

                    {/* Description */}
                    <Text
                      className={cn('text-xs leading-4', isDark ? 'text-gray-500' : 'text-gray-400')}
                      numberOfLines={2}
                    >
                      {btn.description}
                    </Text>

                    {/* Play / Replay chip */}
                    <View
                      className="flex-row items-center mt-3 self-start px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: `${theme.primary}18` }}
                    >
                      <Play size={10} color={theme.primary} fill={theme.primary} />
                      <Text
                        className="text-[10px] font-bold ml-1"
                        style={{ color: theme.primary }}
                      >
                        {seenGuides.includes(btn.id) ? 'Replay' : 'Start Tour'}
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* ── Quick Tips ─────────────────────────────────────────────── */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} className="px-4 mb-4">
            <Text className={cn('text-sm font-semibold mb-3 px-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
              QUICK TIPS
            </Text>
            <View className="flex-row gap-2">
              {quickTips.map((tip) => (
                <View
                  key={tip.id}
                  className={cn(
                    'flex-1 rounded-2xl p-3',
                    isDark ? 'bg-gray-900' : 'bg-white'
                  )}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.5 : 0.2,
                    shadowRadius: 6,
                    elevation: isDark ? 6 : 5,
                  }}
                >
                  <View
                    className="w-9 h-9 rounded-xl items-center justify-center mb-2"
                    style={{ backgroundColor: `${theme.primary}15` }}
                  >
                    {tip.icon}
                  </View>
                  <Text className={cn('font-semibold text-xs mb-1', isDark ? 'text-white' : 'text-gray-900')}>
                    {tip.title}
                  </Text>
                  <Text className={cn('text-[10px] leading-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {tip.description}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
          </>
        )}

        {/* Guide Sections */}
        <View className="px-4 pb-8">
          <Text className={cn('text-sm font-semibold mb-3 px-1', isDark ? 'text-gray-400' : 'text-gray-500')}>
            {searchQuery ? 'SEARCH RESULTS' : 'DETAILED GUIDES'}
          </Text>

          {filteredSections.length === 0 ? (
            <View className="items-center py-12">
              <Search size={48} color={isDark ? '#374151' : '#D1D5DB'} />
              <Text className={cn('text-base mt-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
                No results found for "{searchQuery}"
              </Text>
            </View>
          ) : (
            filteredSections.map((section, index) => (
              <Animated.View
                key={section.id}
                entering={FadeInDown.delay(200 + index * 50).duration(400)}
              >
                <Pressable
                  onPress={() => toggleSection(section.id)}
                  className={cn(
                    'rounded-2xl mb-3 overflow-hidden',
                    isDark ? 'bg-gray-900' : 'bg-white'
                  )}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isDark ? 0.5 : 0.2,
                    shadowRadius: 6,
                    elevation: isDark ? 6 : 5,
                  }}
                >
                  {/* Section Header */}
                  <View className="flex-row items-center p-4">
                    <View
                      className="w-11 h-11 rounded-xl items-center justify-center"
                      style={{ backgroundColor: `${theme.primary}15` }}
                    >
                      {section.icon}
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
                        {section.title}
                      </Text>
                      <Text className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        {section.description}
                      </Text>
                    </View>
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: isDark ? '#374151' : '#F3F4F6' }}
                    >
                      {expandedSection === section.id ? (
                        <ChevronDown size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      ) : (
                        <ChevronRight size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      )}
                    </View>
                  </View>

                  {/* Expanded Content */}
                  {expandedSection === section.id && (
                    <Animated.View
                      entering={FadeIn.duration(200)}
                      className={cn('px-4 pb-4 pt-1 border-t', isDark ? 'border-gray-800' : 'border-gray-100')}
                    >
                      {/* Overview */}
                      <View className={cn('p-3 rounded-xl mb-4', isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                        <Text className={cn('text-sm leading-5', isDark ? 'text-gray-300' : 'text-gray-600')}>
                          {section.overview}
                        </Text>
                      </View>

                      {/* How-To Guides */}
                      {section.guides
                        .filter((guide) => !guide.forTeachers || isTeacher)
                        .map((guide, guideIndex) => {
                          const guideId = `${section.id}-${guideIndex}`;
                          const isGuideExpanded = expandedGuide === guideId;

                          return (
                            <View key={guideIndex} className="mb-2">
                              <Pressable
                                onPress={() => toggleGuide(guideId)}
                                className={cn(
                                  'flex-row items-center p-3 rounded-xl',
                                  isDark ? 'bg-gray-800' : 'bg-gray-50'
                                )}
                              >
                                <View
                                  className="w-7 h-7 rounded-lg items-center justify-center mr-3"
                                  style={{ backgroundColor: `${theme.primary}20` }}
                                >
                                  {isGuideExpanded ? (
                                    <ChevronDown size={14} color={theme.primary} />
                                  ) : (
                                    <ChevronRight size={14} color={theme.primary} />
                                  )}
                                </View>
                                <Text className={cn('flex-1 font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                                  {guide.title}
                                </Text>
                                {guide.forTeachers && (
                                  <View
                                    className="px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: `${theme.secondary}20` }}
                                  >
                                    <Text style={{ color: theme.secondary }} className="text-[10px] font-medium">
                                      Teacher
                                    </Text>
                                  </View>
                                )}
                              </Pressable>

                              {/* Expanded Steps */}
                              {isGuideExpanded && (
                                <Animated.View
                                  entering={FadeIn.duration(200)}
                                  className="mt-2 ml-4"
                                >
                                  {guide.steps.map((step, stepIndex) => (
                                    <View
                                      key={stepIndex}
                                      className={cn(
                                        'flex-row p-3 mb-1 rounded-lg',
                                        isDark ? 'bg-gray-800/50' : 'bg-white'
                                      )}
                                    >
                                      <View
                                        className="w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5"
                                        style={{ backgroundColor: theme.primary }}
                                      >
                                        <Text className="text-white text-xs font-bold">{step.step}</Text>
                                      </View>
                                      <View className="flex-1">
                                        <Text className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                                          {step.title}
                                        </Text>
                                        <Text className={cn('text-xs mt-1 leading-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
                                          {step.description}
                                        </Text>
                                      </View>
                                    </View>
                                  ))}
                                </Animated.View>
                              )}
                            </View>
                          );
                        })}
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            ))
          )}
        </View>

        {/* Role-specific Tips */}
        {!searchQuery && (
          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            className="px-4 pb-8"
          >
            <View
              className={cn('rounded-2xl p-5', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <View className="flex-row items-center mb-3">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: `${theme.primary}15` }}
                >
                  <Sparkles size={22} color={theme.primary} />
                </View>
                <Text className={cn('font-bold text-base ml-3', isDark ? 'text-white' : 'text-gray-900')}>
                  {isTeacher ? 'Teacher Pro Tips' : 'Member Tips'}
                </Text>
              </View>

              {isTeacher ? (
                <View>
                  <Text className={cn('text-sm leading-6 mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Use the <Text className="font-semibold">invite code</Text> in More tab to add new members
                  </Text>
                  <Text className={cn('text-sm leading-6 mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Create <Text className="font-semibold">class-specific channels</Text> for targeted communication
                  </Text>
                  <Text className={cn('text-sm leading-6 mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Set up <Text className="font-semibold">recurring events</Text> for regular classes
                  </Text>
                  <Text className={cn('text-sm leading-6', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Use <Text className="font-semibold">polls</Text> to gather feedback from members
                  </Text>
                </View>
              ) : (
                <View>
                  <Text className={cn('text-sm leading-6 mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • <Text className="font-semibold">RSVP early</Text> to help teachers plan classes
                  </Text>
                  <Text className={cn('text-sm leading-6 mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Check <Text className="font-semibold">Videos tab</Text> regularly for new practice content
                  </Text>
                  <Text className={cn('text-sm leading-6 mb-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Keep your <Text className="font-semibold">dues up to date</Text> in the Financials section
                  </Text>
                  <Text className={cn('text-sm leading-6', isDark ? 'text-gray-300' : 'text-gray-600')}>
                    • Enable <Text className="font-semibold">notifications</Text> to never miss announcements
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Support Section */}
        <Animated.View
          entering={FadeInDown.delay(550).duration(400)}
          className="px-4 pb-8"
        >
          <Pressable
            onPress={() => Linking.openURL('https://www.kolohekinebitz.com/support')}
            className={cn(
              'rounded-2xl p-5 flex-row items-center mb-3',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#FEF2F2' }}
            >
              <Sparkles size={24} color="#F43F5E" />
            </View>
            <View className="flex-1 ml-4">
              <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
                Need More Help?
              </Text>
              <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Visit our support site
              </Text>
            </View>
            <ChevronRight size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL('mailto:support@kolohekinebitz.com')}
            className={cn(
              'rounded-2xl p-5 flex-row items-center',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isDark ? 0 : 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#EFF6FF' }}
            >
              <Send size={24} color="#3B82F6" />
            </View>
            <View className="flex-1 ml-4">
              <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-gray-900')}>
                Email Support
              </Text>
              <Text className={cn('text-sm mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                support@kolohekinebitz.com
              </Text>
            </View>
            <ChevronRight size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
          </Pressable>
        </Animated.View>

        <View style={{ height: insets.bottom + 20 }} />
      </KeyboardAwareScrollView>
    </View>
  );
}
