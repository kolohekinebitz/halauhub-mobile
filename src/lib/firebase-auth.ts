import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  reload,
  type User as FirebaseUser,
} from 'firebase/auth';
import NetInfo from '@react-native-community/netinfo';
import { auth } from './firebase';

export type AuthUser = FirebaseUser;

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

/**
 * Check network connectivity before making auth requests
 */
async function checkNetworkConnection(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  } catch {
    // If NetInfo fails, assume connected and let Firebase handle errors
    return true;
  }
}

/**
 * Sign up a new user with email and password
 * Automatically sends email verification
 */
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  // Check network first
  const isConnected = await checkNetworkConnection();
  if (!isConnected) {
    return { success: false, error: 'No internet connection. Please check your network and try again.' };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Send verification email
    await sendEmailVerification(userCredential.user);

    return { success: true, user: userCredential.user };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    let errorMessage = 'Failed to create account';

    switch (firebaseError.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'This email is already registered';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/weak-password':
        errorMessage = 'Password should be at least 6 characters';
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Email/password accounts are not enabled';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection and try again.';
        break;
      default:
        errorMessage = firebaseError.message || 'Failed to create account';
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Sign in an existing user
 * Returns error if email is not verified
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  // Check network first
  const isConnected = await checkNetworkConnection();
  if (!isConnected) {
    return { success: false, error: 'No internet connection. Please check your network and try again.' };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    return { success: true, user: userCredential.user };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    let errorMessage = 'Failed to sign in';

    switch (firebaseError.code) {
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/user-disabled':
        errorMessage = 'This account has been disabled';
        break;
      case 'auth/user-not-found':
        errorMessage = 'Invalid email or password';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Invalid email or password';
        break;
      case 'auth/invalid-credential':
        errorMessage = 'Invalid email or password';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Too many attempts. Please try again later';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection and try again.';
        break;
      default:
        errorMessage = firebaseError.message || 'Failed to sign in';
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  // Check network first
  const isConnected = await checkNetworkConnection();
  if (!isConnected) {
    return { success: false, error: 'No internet connection. Please check your network and try again.' };
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    let errorMessage = 'Failed to send reset email';

    switch (firebaseError.code) {
      case 'auth/invalid-email':
        errorMessage = 'Invalid email address';
        break;
      case 'auth/user-not-found':
        // Don't reveal if user exists or not for security
        return { success: true };
      case 'auth/network-request-failed':
        errorMessage = 'Network error. Please check your connection and try again.';
        break;
      default:
        errorMessage = firebaseError.message || 'Failed to send reset email';
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Resend verification email to current user
 */
export async function resendVerificationEmail(): Promise<AuthResult> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No user is signed in' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email is already verified' };
    }

    await sendEmailVerification(user);
    return { success: true };
  } catch (error: unknown) {
    const firebaseError = error as { code?: string; message?: string };
    let errorMessage = 'Failed to send verification email';

    if (firebaseError.code === 'auth/too-many-requests') {
      errorMessage = 'Please wait before requesting another email';
    }

    return { success: false, error: errorMessage };
  }
}

/**
 * Refresh the current user's data to check email verification status
 */
export async function refreshUser(): Promise<AuthResult> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No user is signed in' };
    }

    await reload(user);
    return { success: true, user: auth.currentUser ?? undefined };
  } catch (error: unknown) {
    const firebaseError = error as { message?: string };
    return { success: false, error: firebaseError.message || 'Failed to refresh user' };
  }
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): AuthUser | null {
  return auth.currentUser;
}

/**
 * Check if current user's email is verified
 */
export function isEmailVerified(): boolean {
  return auth.currentUser?.emailVerified ?? false;
}

/**
 * Subscribe to authentication state changes
 */
export function onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}
