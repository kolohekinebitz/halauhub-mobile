/**
 * Guide Registry
 * Maps guide IDs to TourConfig objects with step-by-step walkthroughs.
 *
 * targetX / targetY are 0–1 screen-relative coordinates that tell
 * the InteractiveTour overlay where to place the animated pointer.
 *
 * Coordinate reference:
 *  (0,0) = top-left corner
 *  (1,1) = bottom-right corner
 *  (0.5,0.5) = center screen
 *
 * Layout conventions (portrait iPhone/Android):
 *  Top status bar  ≈ y 0.00–0.06
 *  Header / nav    ≈ y 0.06–0.16
 *  Body content    ≈ y 0.16–0.82
 *  Bottom tab bar  ≈ y 0.88–1.00
 *
 *  5-tab bar icons (equally spaced):
 *    Tab 1 Dashboard  x ≈ 0.10
 *    Tab 2 Chat       x ≈ 0.30
 *    Tab 3 Events     x ≈ 0.50
 *    Tab 4 Videos     x ≈ 0.70
 *    Tab 5 More       x ≈ 0.90
 *
 *  Floating Action Button (FAB) on Members/Events/Videos/Waivers:
 *    position: absolute bottom-24 right-4  →  x ≈ 0.88, y ≈ 0.86
 */

import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageCircle,
  Wallet,
  Video,
  FileText,
  ClipboardCheck,
} from 'lucide-react-native';
import React from 'react';
import type { TourConfig } from '@/components/InteractiveTour';

// ─── Individual Guides ─────────────────────────────────────────────────────────

export const GUIDE_REGISTRY: Record<string, TourConfig> = {

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard Guide',
    steps: [
      {
        // Tab 1 is the leftmost tab icon
        targetX: 0.10,
        targetY: 0.93,
        label: 'Home Tab',
        text: "The Dashboard is your home base. Tap the house icon at the bottom-left to return here any time.",
      },
      {
        // Gradient header — halau logo + name sit in the upper portion
        targetX: 0.5,
        targetY: 0.13,
        label: 'School Header',
        text: "Your school's logo and name live here at the top. This is your halau identity — it reflects the branding your teacher set up.",
      },
      {
        // Left stat card (Dancers) overlaps the header with a negative top margin
        targetX: 0.30,
        targetY: 0.28,
        label: 'Dancer Count',
        text: "This card shows the total number of dancers in your halau. Teachers see a badge when new members are waiting for approval.",
      },
      {
        // Right stat card (Events)
        targetX: 0.70,
        targetY: 0.28,
        label: 'Events Count',
        text: "Quick glance at how many upcoming events are scheduled. Tap this card to jump straight to the Events tab.",
      },
      {
        // Quick Actions section — two buttons stacked vertically, upper half of body
        targetX: 0.50,
        targetY: 0.52,
        label: 'Quick Actions',
        text: "Teachers: use Quick Actions to create a new event or mark attendance with a single tap.",
      },
      {
        // Upcoming events list begins around the lower third of the screen
        targetX: 0.50,
        targetY: 0.70,
        label: 'Upcoming Events',
        text: "Scroll down to see your next practices, performances, and meetings listed here in chronological order.",
      },
    ],
  },

  // ── Members ───────────────────────────────────────────────────────────────
  members: {
    id: 'members',
    title: 'Members Guide',
    steps: [
      {
        // More tab is the rightmost (5th) tab
        targetX: 0.90,
        targetY: 0.93,
        label: 'More Tab',
        text: "Tap \"More\" in the bottom-right corner to reach Members, Financials, Waivers, and other management tools.",
      },
      {
        // Search bar at the very top of the members screen
        targetX: 0.50,
        targetY: 0.14,
        label: 'Search & Filter',
        text: "Search any member by name or email. Use the role filter chips below to narrow the list by teacher, student, or class level.",
      },
      {
        // Member cards begin roughly a third of the way down after search + filter chips
        targetX: 0.50,
        targetY: 0.42,
        label: 'Member Card',
        text: "Tap any member card to view their full profile: contact info, class level, membership plan, and attendance history.",
      },
      {
        // Guardian/keiki section is mid-list — guardian cards expand to show linked keiki
        targetX: 0.50,
        targetY: 0.58,
        label: 'Guardian & Keiki',
        text: "Guardians appear with a keiki (child) count badge. Tap the badge to expand and see their linked keiki listed underneath.",
      },
      {
        // Pending banner appears near the top of the member list (below search/filter)
        targetX: 0.50,
        targetY: 0.28,
        label: 'Pending Approvals',
        text: "Teachers see an amber banner when new students are waiting for approval. Tap it to review and accept or decline their request.",
      },
      {
        // FAB (floating action button) — bottom-24 right-4 = bottom-right of screen
        targetX: 0.88,
        targetY: 0.86,
        label: 'Add Member',
        text: "Teachers: tap the + button at the bottom-right to add a new member manually or share the school invite code.",
      },
    ],
  },

  // ── Events ────────────────────────────────────────────────────────────────
  events: {
    id: 'events',
    title: 'Events Guide',
    steps: [
      {
        // Tab 3 is the center tab
        targetX: 0.50,
        targetY: 0.93,
        label: 'Events Tab',
        text: "Tap the calendar icon at the bottom center to open the Events section.",
      },
      {
        // View toggle (Calendar / List) is in the top header area of the events screen
        targetX: 0.50,
        targetY: 0.16,
        label: 'View Toggle',
        text: "Switch between Calendar view (month grid) and List view (all events in sequence) using the toggle at the top.",
      },
      {
        // Calendar grid sits in the upper-middle of the screen
        targetX: 0.50,
        targetY: 0.38,
        label: 'Calendar',
        text: "In Calendar view, tap any date to see what's scheduled. Colored dots below dates signal there are events on that day.",
      },
      {
        // Event cards appear below the calendar or fill the screen in list view
        targetX: 0.50,
        targetY: 0.62,
        label: 'Event Card',
        text: "Tap any event card to see full details — date, time, location, and description.",
      },
      {
        // RSVP buttons sit inside the event card on the right side
        targetX: 0.75,
        targetY: 0.62,
        label: 'RSVP',
        text: "Tap Going, Maybe, or Can't Go to let your teacher know your availability. You can update your response anytime.",
      },
      {
        // FAB is bottom-24 right-4
        targetX: 0.88,
        targetY: 0.86,
        label: 'Create Event',
        text: "Teachers: tap the + button at the bottom-right to create a new practice, performance, meeting, or workshop. You can set it as recurring too.",
      },
    ],
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  chat: {
    id: 'chat',
    title: 'Chat Guide',
    steps: [
      {
        // Tab 2 is second from the left
        targetX: 0.30,
        targetY: 0.93,
        label: 'Chat Tab',
        text: "Tap the chat bubble icon to open the Chat section. A red badge shows the count of unread messages.",
      },
      {
        // Channel list fills most of the screen; rows start around y=0.25
        targetX: 0.50,
        targetY: 0.35,
        label: 'Channel List',
        text: "All your halau's channels are listed here. Each row shows the channel name and a preview of the last message.",
      },
      {
        // Unread badge is on the right side of a channel row
        targetX: 0.85,
        targetY: 0.35,
        label: 'Unread Badge',
        text: "Red badges on a channel mean there are new messages waiting for you. Tap the channel to read them.",
      },
      {
        // Message input bar is at the very bottom, just above the keyboard
        targetX: 0.55,
        targetY: 0.91,
        label: 'Message Input',
        text: "Inside a channel, type your message in the bar at the bottom. Tap the arrow to send.",
      },
      {
        // Image icon is to the left of the message input
        targetX: 0.12,
        targetY: 0.91,
        label: 'Share Image',
        text: "Tap the image icon to share a photo from your gallery or take a new one right in the app.",
      },
      {
        // Poll icon is next to the image icon in the input bar
        targetX: 0.25,
        targetY: 0.91,
        label: 'Create Poll',
        text: "Tap the poll icon to post a question with multiple-choice options. Great for scheduling or getting group feedback.",
      },
      {
        // Long-press on a message — messages occupy the mid-section
        targetX: 0.50,
        targetY: 0.52,
        label: 'Reactions',
        text: "Long-press any message to add an emoji reaction or delete your own messages.",
      },
    ],
  },

  // ── Financials ────────────────────────────────────────────────────────────
  financials: {
    id: 'financials',
    title: 'Financials Guide',
    steps: [
      {
        // More tab is the rightmost (5th) tab
        targetX: 0.90,
        targetY: 0.93,
        label: 'More Tab',
        text: "Access Financials from the More tab at the bottom-right, then select \"Financials\" from the list.",
      },
      {
        // Summary cards (Pending, Overdue, Disburse) sit inside the gradient header
        targetX: 0.50,
        targetY: 0.18,
        label: 'Summary Cards',
        text: "At the top you'll see totals: Pending, Overdue, and Disbursed. Teachers see school-wide totals; students see their own balance.",
      },
      {
        // Quick Actions row: 3 cards (Set Up | Record | Export) — sits just below the header
        targetX: 0.20,
        targetY: 0.46,
        label: 'Set Up Dues',
        text: "Teachers: tap \"Set Up\" to create dues templates and assign them to individual members or an entire class level.",
      },
      {
        // Record Payment is the middle quick-action card
        targetX: 0.50,
        targetY: 0.46,
        label: 'Record Payment',
        text: "Teachers: tap \"Record\" to log a cash, Venmo, or Zelle payment and mark a member's due as paid.",
      },
      {
        // Tab bar: Dues | Expenses | History — appears below the quick actions separator
        targetX: 0.20,
        targetY: 0.64,
        label: 'Dues Tab',
        text: "The Dues tab lists all dues by student with their total balance and status. Tap a student row to expand their individual dues.",
      },
      {
        // Expenses tab is the second tab in the row
        targetX: 0.50,
        targetY: 0.64,
        label: 'Expenses Tab',
        text: "View and request reimbursements for halau-related expenses here. Students can attach a receipt photo as proof.",
      },
    ],
  },

  // ── Videos ────────────────────────────────────────────────────────────────
  videos: {
    id: 'videos',
    title: 'Videos Guide',
    steps: [
      {
        // Tab 4 is second from the right
        targetX: 0.70,
        targetY: 0.93,
        label: 'Videos Tab',
        text: "Tap the video icon in the bottom nav to open the Video Library.",
      },
      {
        // Search bar is at the very top of the videos screen
        targetX: 0.50,
        targetY: 0.14,
        label: 'Search Bar',
        text: "Use the search bar at the top to find any video by title, dance name, or song.",
      },
      {
        // Category filter chips are directly below the search bar
        targetX: 0.50,
        targetY: 0.22,
        label: 'Categories',
        text: "Videos are organised into categories like Practice, Performances, and Tutorials. Tap a category chip to filter.",
      },
      {
        // Video thumbnails fill the main content area in a 2-column grid
        targetX: 0.50,
        targetY: 0.52,
        label: 'Video Thumbnail',
        text: "Tap any thumbnail to open the full-screen video player. Use the controls to play, pause, and scrub through the video.",
      },
      {
        // FAB is bottom-24 right-4
        targetX: 0.88,
        targetY: 0.86,
        label: 'Upload Video',
        text: "Teachers: tap the + button at the bottom-right to upload a new video from your gallery. Add a title, description, and set the category.",
      },
    ],
  },

  // ── Waivers ───────────────────────────────────────────────────────────────
  waivers: {
    id: 'waivers',
    title: 'Waivers Guide',
    steps: [
      {
        // More tab is the rightmost (5th) tab
        targetX: 0.90,
        targetY: 0.93,
        label: 'More Tab',
        text: "Go to More → Waivers to find all documents your halau requires you to complete.",
      },
      {
        // Document list starts near the top of the waivers screen
        targetX: 0.50,
        targetY: 0.30,
        label: 'Document List',
        text: "Each waiver shows its name, description, and current status: Pending, Signed, or Expired.",
      },
      {
        // Status badge is on the left side of each waiver card
        targetX: 0.15,
        targetY: 0.38,
        label: 'Status Badge',
        text: "A red badge means this document is still waiting for your signature. Orange means it's expiring soon.",
      },
      {
        // Tapping a waiver opens it — the sign action is mid-screen
        targetX: 0.50,
        targetY: 0.52,
        label: 'Sign In-App',
        text: "Tap a waiver card to open it. Scroll to the bottom, type your full name, and tap Sign to complete it.",
      },
      {
        // External form waivers appear further down the list
        targetX: 0.50,
        targetY: 0.65,
        label: 'External Forms',
        text: "Some waivers link to Google Forms or DocuSign. Tap the card to open it in your browser and follow the instructions.",
      },
      {
        // FAB is bottom-24 right-4
        targetX: 0.88,
        targetY: 0.86,
        label: 'Add Waiver',
        text: "Teachers: tap the + button at the bottom-right to add a new waiver. Choose an in-app form or paste a URL to an external form.",
      },
    ],
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  attendance: {
    id: 'attendance',
    title: 'Attendance Guide',
    steps: [
      {
        // Tab 3 is the center tab
        targetX: 0.50,
        targetY: 0.93,
        label: 'Events Tab',
        text: "Attendance is tied to Events. Start by opening the Events tab at the bottom of the screen.",
      },
      {
        // Event cards are in the lower half of the events screen
        targetX: 0.50,
        targetY: 0.62,
        label: 'Select Event',
        text: "Tap on the event you want to take attendance for. You can mark attendance for any event that has already started.",
      },
      {
        // "Take Attendance" button is in the event detail — upper area of that screen
        targetX: 0.50,
        targetY: 0.32,
        label: 'Take Attendance',
        text: "Teachers: inside the event details, tap \"Take Attendance\" to open the attendance sheet.",
      },
      {
        // Member rows fill the attendance sheet — mid screen
        targetX: 0.50,
        targetY: 0.52,
        label: 'Mark Members',
        text: "A list of all members appears. Tap each name to toggle them between Present and Absent.",
      },
      {
        // Note icon on the right side of a member row
        targetX: 0.80,
        targetY: 0.60,
        label: 'Add Notes',
        text: "Tap the note icon next to any member to add a short note (e.g., \"Arrived late\" or \"Left early\").",
      },
      {
        // Save button is at the bottom of the attendance sheet
        targetX: 0.50,
        targetY: 0.84,
        label: 'Save',
        text: "Tap Save when you're done. Attendance records are stored permanently and show up in each member's profile.",
      },
    ],
  },
};

// Helper to get a guide by id
export function getGuide(id: string): TourConfig | null {
  return GUIDE_REGISTRY[id] ?? null;
}
