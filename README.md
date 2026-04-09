# Halau - Hula School Management App (v2.3.9)

## Firebase Auth + Firestore User System (Fixed March 2026)

### Root causes fixed:
1. **Dashboard stuck loading for new users** — The P6 provisional-member logic now only fires when Firestore genuinely _times out_ (`fetchTimedOut === true`). Brand-new users whose doc simply doesn't exist yet are routed to onboarding as intended.
2. **Duplicate/blank members** — Member records are now created with `id: currentUser.id` (the Firebase UID) everywhere (`createHalau`, `joinHalauByCode`, `requestToJoinHalau`), eliminating random-UUID duplicates.
3. **Teacher accounts duplicated** — Previously `createHalau` used `generateId()` so sign-in seeding created a second record. Now the single UID-keyed doc is used and re-used.
4. **New users not appearing in member lists** — The non-blocking member-seeding loop now also checks `doc.userId === currentUser.uid` (not just `doc.id`) so legacy random-UUID members are correctly skipped for the current user and de-duped against existing records.
5. **Student status never updating after approval** — After the non-blocking Firestore member fetch, `currentMember` is now synced if `status`, `role`, or `classLevel` changed. `refreshSchoolData` also patches `currentMember`.
6. **Background re-fetch now sets `currentHalauId`** — If Firestore timed out during sign-in and the background re-fetch returns a `schoolId`, `currentHalauId` is set immediately so the router can redirect to tabs.

A comprehensive mobile application for managing hula schools (halau), built with React Native and Expo.

## Apple IAP Compliance Checklist (March 2026)

### Completed in-app (no action needed)
- **Full auto-renewal disclosure** on paywall: Payment charged to Apple ID, auto-renews unless cancelled 24h before period end, unused trial forfeited on purchase.
- **Working ToS & Privacy links**: Paywall footer links open `halauhub.com/terms` and `halauhub.com/privacy` via `Linking.openURL`.
- **Manage Subscription route**: Tapping the active subscription card in the More tab opens `https://apps.apple.com/account/subscriptions` directly.
- **Restore Purchases button**: Available in paywall header for all users.
- **Students always free**: Clearly disclosed on paywall — "Students & guardians always have full access for free — no subscription required."
- **External donation links hidden from teachers/owners**: Ko-Fi link only shown to students/guardians to avoid App Store guideline 3.1.1 issues.

### Required actions in App Store Connect (manual — cannot be done in code)
These must be completed by the developer before submission:

1. **Create subscription products in App Store Connect** with identifiers:
   - `owner_monthly_999` → "School Owner - $9.99/month" — Monthly, $9.99 USD
   - `school_owner_monthly_699` → "HalauHub School Admin" — Monthly, $6.99 USD
   - Set subscription group name (e.g., "HalauHub School Plans") for both.
   - Set **14-day free trial** on each product (App Store Connect → Subscription → Free Trial).

2. **Add In-App Purchase review screenshot** — Apple requires a screenshot of the paywall for review.

3. **Add subscription review notes** explaining:
   - Teachers/owners pay $9.99/mo to manage the school.
   - Admins pay $6.99/mo for management access without ownership.
   - Students/guardians are always free.
   - 14-day free trial is offered to teachers.

4. **Set up App Store Connect API key** in RevenueCat (required for product import and grace period handling):
   - RevenueCat → Project Settings → Apps → HalauHub (App Store) → App Store Connect API Key
   - Upload P8 key, Key ID, and Issuer ID from App Store Connect → Users & Access → Keys.

5. **Subscription description text** (shown in App Store product page):
   - Teacher plan: "Manage your halau — unlimited members, events, videos, payments, chat, and branding."
   - Admin plan: "Full admin access to manage members, events, finances, and communications."

### RevenueCat product mapping (active)
| Package ID | Entitlement | App Store SKU | Price |
|---|---|---|---|
| `$rc_monthly_owner_teacher` | `school_owner_teacher` | `owner_monthly_999` | $9.99/mo |
| `$rc_monthly_school_owner` | `school_owner` | `school_owner_monthly_699` | $6.99/mo |



## Recent Updates (World-Class Certification Pass — March 2026)
- **Rate Limiter**: Backend now enforces 60 req/60s per-IP sliding window on all `/api/*` routes (webhooks exempt). Returns `429` with `Retry-After` header on breach.
- **iOS Privacy Manifest**: `plugins/withPrivacyManifest.js` added — auto-generates `PrivacyInfo.xcprivacy` during EAS Build with 5 `NSPrivacyCollectedDataTypes` and 4 `NSPrivacyAccessedAPITypes`. Registered in `app.json`.
- **NSPhotoLibraryAddUsageDescription** + **NSDocumentsFolderUsageDescription** added to `app.json` — required by `expo-image-picker` and `expo-document-picker` respectively.
- **Backend Pagination**: `/members` and `/events` endpoints now accept `?limit=` and `?startAfter=` cursor params; return `nextCursor` for multi-page access.
- **syncToBackend Retry**: Exponential backoff (1s → 2s → 4s, 3 attempts) replaces fire-and-forget; 5xx and network failures both retry.
- **Global Error Handler**: `app.onError()` returns `{ ok: false, code, message }` on all unhandled exceptions.
- **Latency Middleware**: Any route exceeding 500ms logs `[perf] SLOW` to server.log.

## Sentry Activation (Manual Step Required)
Sentry integration is wired and dormant. To activate crash telemetry:
1. Create a project at sentry.io
2. Copy the DSN from Settings → Projects → Keys
3. In the Vibecode ENV tab, set: `EXPO_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>`

## Recent Updates (v1.6.9)
- **Phone Number Formatting**: All phone input fields now show `(###) ###-####` placeholder for area code clarity
- **Dues Template Save Button**: Fixed Save button disappearing when keyboard opens - now has sticky bottom button always visible
- **Checkmark Consistency**: All save/confirm actions now use checkmark icons instead of mixed Save/Check buttons
- **Event Edit/Delete Overlays**: Replaced iOS-crashing Modal popups with inline overlay UI for recurring event scope selection
- **Class Level Rename Fix**: Fixed iOS crash when renaming class levels - now uses inline form instead of stacked transparent modals
- **Event Start & End Time**: Events now support both start time and end time fields in create/edit
- **Keyboard Visibility**: Increased scroll padding app-wide so active input fields are never hidden behind the keyboard
- **Video Class Access Control**: When adding videos, teachers can now set a date and restrict visibility to specific class levels

## Features

### Onboarding Experience
- **Welcome Flow**: Beautiful 8-screen intro with animated transitions
  - Welcome screen with app tagline and mission
  - Feature highlights: Dashboard, Member Management, Event Scheduler
  - Communication features: Team Chat, Digital Waivers, Payment Tracking
  - Efficiency tools: Class Levels, RSVPs, Video Library, Custom Roles
- **Personalization Questionnaire**: Customize experience based on:
  - User role (Teacher, Student, Administrator, Parent)
  - Event frequency (Daily, Weekly, Biweekly, Monthly)
  - Priorities (Time Management, Communication, Student Growth, Organization)
- **Persistent State**: Welcome screens only shown once per device
  - First-time users see the full intro experience
  - Returning users go directly to login screen
  - "Skip" and "I Already Have an Account" buttons navigate directly to login
  - State persisted via device storage
- **School Selection Screen**: After login, new users see three options:
  - **Create a School**: Start your own school as an owner/teacher
  - **Join a School**: Join as a student with an invite code
  - **Parent/Guardian**: Sign up your child(ren) - restricted to dashboard until children are assigned to a class by the teacher

### For Kumu (Teachers)
- **Dashboard**: Overview of members, events, payments, and quick actions
  - **Dancers Count**: Shows only active dancers (excludes guardians, includes keiki/minors)
  - **Events Count**: Shows only events the current user is assigned or invited to
- **Member Management**: Add, approve, and manage students (haumana)
- **Remove Students**: Remove students with confirmation - deletes all associated data including attendance, payments, chat messages, and more
- **Owner Protection**: The school owner cannot lose admin permissions unless they explicitly choose to relinquish them
  - Owner badge displayed on member profile
  - Warning confirmation required when owner tries to change their own role
  - Other admins/teachers cannot change the owner's role
- **Class Level Assignment**: Assign class levels (Keiki, Beginner, Intermediate, Advanced) to members during approval or anytime
  - Notification for members needing class assignment
  - Quick assignment from member list
  - **Pending & Assignments Screen**: Combined view showing pending member approvals AND minors awaiting class assignment
  - Minors created by parents/guardians appear here for teachers to assign classes
  - Once assigned, parents/guardians gain full app access
  - **Custom Class Levels**: Add custom class levels beyond the defaults
  - Rename default class levels (Minors, Beginner, Intermediate, Advanced) and custom class levels
  - Delete custom class levels (default levels cannot be deleted)
- **Paying Member Status**: Automatic "Paying" badge shown for members with active dues (monthly/annual payments) - visible to all users
- **Custom Titles**: Rename teacher, student, and admin titles throughout the app (e.g., "Kumu" instead of "Teacher", "Haumana" instead of "Student")
- **Payment Tracking**: Record payments via Venmo, Zelle, Cash, or Check
  - Pull-to-refresh support for updating payment data
- **Event Management**: Create events with calendar view and track RSVPs
  - Unified date picker shows day of week, month, day, and year in a single scrollable list
  - Teachers, owners, and admins have full editing permissions from dashboard event details
- **Recurring Events**: Create daily, weekly, biweekly, or monthly recurring events
  - Recurring dates maintain the same day of the week (e.g., if scheduled for Friday, all occurrences are on Friday)
  - Monthly recurrence finds the same occurrence of the day (e.g., 2nd Friday of each month)
  - Edit single event instance or entire series
  - **Convert to Recurring**: Edit any existing event and make it recurring with pattern and end date selection
  - Delete single occurrence, this and future, or entire series
  - Visual indicator showing recurring pattern on event details
- **Performance Participant Selection**: Choose which members participate in performances
  - Quick-select by class level (All Halau, Advanced, Intermediate, Beginner, Keiki)
  - Individual member selection with class level badges
  - Edit performers after event creation (teachers, owners, and admins)
  - RSVP buttons (Going, Maybe, Can't Go) with improved spacing for better touch targets
- **Participant Selection for All Events**: Practice, meeting, workshop, and other events now support participant selection
  - Same interface as performance participant selection
  - Track who is expected at each event
- **Performer Response Tracking**: View RSVP summary for performance participants (Going, Maybe, Can't Go, Pending)
- **Attendance**: Mark attendance for each event
- **Show Management**: Track performances with start/end times, locations, and dancer assignments
- **Video Library**: Upload and organize practice videos with YouTube and native video support
- **Digital Waivers**: Create and track waiver signatures
- **Team Chat**: Real-time messaging with channels
  - Create channels with member visibility controls
  - **Class Level Selection**: Add members by class level when creating channels
  - Manage who can see each channel
  - General chat visible to all members
  - **Pin Messages**: Teachers/admins can pin important messages for easy reference
  - **Private Messaging**: Send private messages within channel that only sender and recipients can see
  - @mention individuals in messages
  - Emoji reactions on messages (long press to react)
  - **Reply Threading**: Reply to messages with visual link back to original - tap to scroll to original message
  - Create timed polls (1h, 24h, 3d, 7d, or no limit)
  - See voter names under poll options
  - **Change Votes**: Users can change their vote while poll is active
  - **Poll End Indicator**: Gold trophy icon displayed when polls end
  - Attachment menu with Photo, GIF, Poll, File, and Camera options
  - **Instant Updates**: Messages appear immediately after sending

### For Haumana (Students)
- **Dashboard**: View upcoming events, shows you're performing in, and personal stats
- **RSVP to Events**: Respond to event invitations
- **Performance Events**: Only see performances you're participating in (on dashboard and calendar)
  - RSVP to performances you're selected for (Going, Maybe, Can't Go)
  - Access full event details from dashboard or events tab with same editing features
- **Watch Videos**: Access practice and performance videos
- **Sign Waivers**: Digitally sign required waivers
- **Team Chat**: Communicate with the halau (only channels you're added to)
- **Keiki Management**: Register your children (keiki) for classes and events
  - Any member can add their keiki
  - Only the guardian, kumu, or admin can remove a keiki
  - Guardians receive notifications for events their keiki are participating in
  - **Class Level Editing**: Owner and admins can edit class levels for keiki from the member detail screen
- **Event Visibility**: Only see events you are assigned to (individually or by class level)
  - Teachers/admins see all events
  - Students/guardians only see events they or their keiki are assigned to
  - Events without participant assignments show to all (backwards compatible)

### For Parents/Guardians
- **Parent/Guardian Account Type**: Sign up specifically as a parent/guardian when joining a school
- **Restricted Access Until Assigned**: New parents see a limited dashboard until their children are assigned to a class
  - Shows waiting status with helpful information
  - Displays list of registered children and their assignment status
  - Sign out option available from the restricted view
- **Add Children (Keiki)**: Register your children directly from the restricted dashboard
  - Add multiple children as needed
  - "Add Another Child" button always available for families with multiple children
- **Track Multiple Children**: See all your children's assignments and class levels
- **Event Visibility**: See events your children are assigned to
- **Automatic Full Access**: Gain full app access once your child(ren) are assigned to a class by the teacher

## Tech Stack

- **Framework**: Expo SDK 53 + React Native 0.79
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand with AsyncStorage persistence
- **Authentication**: Firebase Auth with email verification
- **Styling**: NativeWind (TailwindCSS for React Native)
- **Animations**: React Native Reanimated
- **Icons**: Lucide React Native

## Firebase Authentication

This app uses Firebase Authentication for secure user management with email verification.

### Environment Variables Required
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Authentication Flow
1. **Sign Up**: User creates account with email/password
2. **Email Verification**: Firebase sends verification email automatically
3. **Verify Email Screen**: User is prompted to verify their email
4. **Continue to App**: After verification, user proceeds to onboarding/main app

### New User Detection
- Firebase auth state is synced on startup, but `isAuthenticated` is only set to `true` if a matching local user profile exists
- This ensures new users on fresh devices always see the intro/welcome screens, even if Firebase has a cached session
- When a user signs in or signs up, a local user profile is created, enabling proper authentication state

## Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Bottom tab navigation
│   │   ├── index.tsx      # Dashboard
│   │   ├── chat.tsx       # Team Chat
│   │   ├── events.tsx     # Events Calendar
│   │   ├── videos.tsx     # Video Library
│   │   └── more.tsx       # Settings & More
│   ├── auth.tsx           # Login/Signup
│   ├── verify-email.tsx   # Email verification screen
│   ├── onboarding.tsx     # Halau creation/joining
│   ├── members/           # Member management
│   ├── payments/          # Payment tracking
│   ├── shows/             # Show management
│   ├── waivers/           # Digital waivers
│   └── attendance.tsx     # Attendance marking
├── components/            # Reusable UI components
└── lib/
    ├── firebase.ts        # Firebase initialization
    ├── firebase-auth.ts   # Firebase auth service
    ├── store.ts          # Zustand store with all app state
    ├── types.ts          # TypeScript type definitions
    ├── cn.ts             # ClassName utility
    └── useColorScheme.ts # Theme hook
```

## Data Model

### Core Entities
- **User**: Authentication and account data
- **Member**: Halau membership with role (kumu/admin/haumana)
- **Halau**: Organization with branding
- **Event**: Practices, performances, meetings
- **Payment**: Financial tracking
- **Show**: Performance records with selected dancer visibility in dashboard
- **Video**: Practice video library
- **Waiver**: Digital waivers with signatures
- **ChatChannel/ChatMessage**: Team communication

## Roles & Permissions

### Free Donation-Based Model

The app is **completely free** for all users with **no restrictions**. All features are available to everyone - schools and students alike.

#### How It Works
- **No Subscription Required**: Create schools, add unlimited students, and access all features at no cost
- **Donation-Based Support**: The app is supported entirely by voluntary donations from the community
- **Donation Modal**: After creating or joining a school, users see a donation prompt explaining how donations help:
  - Keep the app free for all schools
  - Cover server and infrastructure costs
  - Fund new feature development
  - Support bug fixes and improvements
- **Donation Link**: [ko-fi.com/kolohekinebitz](https://ko-fi.com/kolohekinebitz)
- **Always Optional**: Users can skip the donation and use the app with full functionality

#### All Features Included (Free)
- Unlimited students
- View & edit members
- Payment management & tracking
- Event creation & management
- Video library
- Chat management
- Admin roles
- Custom school branding
- Permissions management
- And all other features!

### Kumu (Teacher/Owner)
- Full access to all features
- Manage members and approvals
- Assign admin roles to students
- Assign class levels to students and minors
- Track finances
- Create events and shows
- Manage videos and waivers
- View reports
- Assign events to individuals or class levels

### Admin (Elevated Student)
- Elevated permissions similar to Kumu
- Help manage the halau
- Can be assigned by Kumu in Permissions settings
- Access to member management, payments, events
- Can assign class levels to members

### Haumana (Student)
- View events and RSVP
- See shows they're assigned to in dashboard
- Watch videos
- Chat with team
- Sign waivers
- View personal history
- **Restricted Access Until Class Assigned**: New students see limited dashboard until assigned to a class

### Parent/Guardian
- View events their children are assigned to
- See shows their children are participating in
- Watch videos
- Chat with team (channels they're added to)
- Add and manage their keiki (children)
- View children's attendance and class info
- **Restricted Access Until Children Assigned**: Parents see limited dashboard until children are assigned to a class

## Getting Started

1. The app starts at the auth screen
2. Sign up with email/password
3. Create a new halau OR join with an invite code
4. Start managing your hula school!

## Customization

### Halau Branding & Theme System
- **12 Culturally-Inspired Theme Palettes**: Choose from themes inspired by Hawaiian and Pacific Island aesthetics:
  - Ocean Mist - Calm, coastal vibes (Default theme for welcome screens)
  - Island Sunset - Warm, golden hues
  - Fern Valley - Lush, natural greens
  - Orchid Garden - Elegant, soft purples
  - Sandy Shore - Warm, earthy neutrals
  - Blue Lagoon - Deep, serene blues
  - Coral Reef - Vibrant, playful corals
  - Volcanic Earth - Rich, grounded tones
  - Plumeria Bloom - Soft, floral whites
  - Maile Lei - Sacred, deep greens
  - Tapa Cloth - Traditional earth tones
  - Moonlit Shore - Cool, peaceful nights
- **Consistent Theme Colors**: Welcome screens (intro, auth, verify-email, onboarding) use the default Ocean Mist theme for a cohesive first impression
- **Cultural Notes**: Each theme includes cultural inspiration notes
- **Live Preview**: See your theme changes in real-time
- **Logo Upload**: Add your school's logo
- **Softer, Modern Aesthetic**: Refined colors with softer tones throughout the app

### Dark Mode
- Toggle in More > Settings
- True black background for OLED screens
- All UI elements properly styled for dark/light themes
- Theme colors adapt automatically to dark mode

## Payment Tracking

This app tracks payments only - it does not process payments. Supported methods:
- Venmo
- Zelle
- Cash
- Check

Track payment status: Paid, Partial, Pending, Overdue

## Financial Management Module

A comprehensive financial management system for schools/clubs with role-based access.

### Redesigned Financials Tab (Modern UI)
- **Clean Visual Hierarchy**: Quick Actions displayed above category tabs
- **Removed Clutter**: Overview button removed, streamlined navigation
- **Animated Interactions**: Tap animations on all interactive elements
- **Soft Shadows & Cards**: Subtle elevation for visual separation
- **Consistent Typography**: Section labels, larger headings, clear hierarchy
- **Accent Color Palette**: Emerald (success), Amber (pending), Red (overdue), Purple (expenses)

### For Kumu/Admin
- **Summary Cards**: At-a-glance view of Collected, Pending, Overdue, and Owed amounts
- **Quick Actions**:
  - Manage Created Payments: Create and assign dues
  - Record Payment: Log transactions
- **Pending Approvals Alert**: Highlighted notification for expense reviews
- **Browse Tabs**: Dues, Expenses, History with smooth transitions
- **Organization Dues**: Create reusable dues templates (School Dues, Performance Dues, Miscellaneous)
- **Assign Dues**: Bulk assign dues to members with custom due dates
- **Record Payments**: Track payments with method (Cash, Check, Venmo, Zelle)
- **Expense Approval**: Review and approve/deny reimbursement requests
- **Release Payments**: Release approved expenses to members
- **Transaction History**: View all financial transactions
- **Confirm Payments Section**: Review and confirm student-submitted payments
  - Notification badge on Pending card shows count of pending confirmations
  - Confirm or reject payments with one tap
  - Records who approved/confirmed each payment
- **Transaction Details**: Tap any transaction in Dues, Expenses, or History to see full details:
  - **Dues Detail (Admin)**: View assigned member, status, progress, payment history, who created the due, related transactions, and recurring schedule info
  - **Expense Detail**: View requester, category, approval status, who approved/released, and payment release info
  - **Transaction Detail**: View transaction type, amount, payment method, who paid, who recorded it, date/time, and related due/expense

### For Students
- **My Payments**: View pending and paid dues
- **Payment Details Page**: Tap on any due to view full details and payment options
  - Select payment method (Venmo, Zelle, Cash, Check)
  - Submit payment for instructor confirmation
  - Track pending confirmation status
- **Request Reimbursement**: Submit expense requests for approval
- **Track Expenses**: Monitor status of reimbursement requests
- **Payment History**: View personal transaction history

### Payment Confirmation Flow
1. Student views pending dues in Financials tab
2. Student taps on a due to open payment details
3. Student selects payment method and submits payment
4. Instructor sees notification badge on Pending card
5. Instructor reviews in "Confirm Payments" section
6. Instructor confirms or rejects the payment
7. Confirmed payments are recorded in Transaction History with approver info

### Notifications
- Members receive notifications for new dues assigned
- Payment confirmation notifications
- Expense approval/denial notifications
- Payment release notifications

### Dues Categories
- School Dues
- Performance Dues
- Miscellaneous Dues
- Overdue Expenses (reimbursements)

### Payment Frequencies
- Weekly
- Monthly
- Annually

### Recurring Payments
Teachers, owners, and admins can set up recurring payment schedules when assigning dues:
- **Custom Payment Date**: Select any date for the first payment
- **Recurring Toggle**: Enable recurring payments with a single tap
- **Frequency Options**:
  - Weekly: Payment due on the same day each week
  - Every 2 Weeks (Biweekly): Payment due every other week
  - Monthly: Payment due on the same day of each month (e.g., the 26th)
- **End Date**: Set when recurring payments should stop
- **Quick End Date Options**: 3 months, 6 months, or 1 year presets
- **Payment Schedule Preview**: Shows exactly when payments will be due
- **Example**: Set payment for Feb 26, 2026, monthly recurring until Dec 2026 → Creates payments due on the 26th of each month
