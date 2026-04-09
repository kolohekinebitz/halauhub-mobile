# Firebase Authentication Integration Plan

## Overview
Add Firebase Authentication with email verification to replace the current local authentication system. This will provide real security with verified user emails.

## What You Need to Do (Setup Steps)

### Step 1: Create a Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Create a project" (or "Add project")
3. Enter a project name (e.g., "Halau App")
4. Disable Google Analytics (optional, simplifies setup)
5. Click "Create project" and wait for it to finish
6. Click "Continue"

### Step 2: Enable Email/Password Authentication
1. In your Firebase project, click "Authentication" in the left sidebar
2. Click "Get started"
3. Click on "Email/Password" provider
4. Toggle "Enable" to ON
5. Toggle "Email link (passwordless sign-in)" to OFF (we don't need it)
6. Click "Save"

### Step 3: Get Your Firebase Configuration
1. Click the gear icon (Settings) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>) to add a web app
5. Enter an app nickname (e.g., "Halau Web")
6. Click "Register app"
7. You'll see a config object - copy these values:
   - apiKey
   - authDomain
   - projectId
   - storageBucket
   - messagingSenderId
   - appId

### Step 4: Add Environment Variables in Vibecode
Go to the **ENV tab** in Vibecode and add these variables (using your values from Step 3):

```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Step 5: Customize Verification Email (Optional)
1. In Firebase Console, go to Authentication > Templates
2. Click "Email address verification"
3. Customize the subject and message if desired
4. Click "Save"

---

## What I Will Implement (Code Changes)

### 1. Create Firebase Configuration File
- Create `src/lib/firebase.ts` with Firebase initialization
- Use environment variables for configuration

### 2. Create Firebase Auth Service
- Create `src/lib/firebase-auth.ts` with authentication functions:
  - `signUpWithEmail(email, password)` - Creates account + sends verification email
  - `signInWithEmail(email, password)` - Signs in (checks if email verified)
  - `signOut()` - Signs out user
  - `sendPasswordReset(email)` - Sends password reset email
  - `resendVerificationEmail()` - Resends verification email
  - `onAuthStateChanged(callback)` - Listens for auth state changes

### 3. Update Store
- Modify `src/lib/store.ts` to use Firebase Auth instead of local auth
- Keep local user profile data (firstName, lastName, phone) synced with Firebase UID
- Add `isEmailVerified` state tracking

### 4. Update Auth Screen
- Modify `src/app/auth.tsx` to use Firebase Auth
- Add email verification pending screen
- Add "Resend verification email" button
- Show appropriate messages for unverified users

### 5. Update Root Layout
- Modify `src/app/_layout.tsx` to check email verification status
- Redirect unverified users to verification pending screen

### 6. Create Verification Pending Screen
- Create `src/app/verify-email.tsx` screen
- Show instructions to check email
- Add "Resend email" and "Sign out" buttons
- Add "I've verified my email" button to refresh status

---

## Authentication Flow After Implementation

1. **Sign Up**: User enters email/password → Account created → Verification email sent → Redirected to verification screen
2. **Check Email**: User clicks link in email → Email marked as verified in Firebase
3. **Continue to App**: User taps "I've verified" → App checks status → If verified, continue to onboarding
4. **Sign In**: User enters email/password → If not verified, show verification screen → If verified, enter app

---

## Security Benefits
- Real email verification (can't use fake emails)
- Secure password hashing handled by Firebase
- Protection against brute force attacks
- Secure password reset flow
- Industry-standard authentication

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/firebase.ts` | Create |
| `src/lib/firebase-auth.ts` | Create |
| `src/lib/store.ts` | Modify |
| `src/app/auth.tsx` | Modify |
| `src/app/_layout.tsx` | Modify |
| `src/app/verify-email.tsx` | Create |
| `src/lib/types.ts` | Minor update |

