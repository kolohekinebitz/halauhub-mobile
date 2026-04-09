/**
 * Subscription Management Module
 *
 * Pricing model:
 *  - Teachers / Instructors (halau owners) → $9.99/month ("school_owner_teacher" entitlement)
 *  - Admins → $6.99/month ("school_owner" entitlement)
 *  - Students and Guardians → always free, no paywall
 *
 * RevenueCat packages:
 *   Teacher plan : $rc_monthly_owner_teacher   → school_owner_teacher entitlement
 *   Admin plan   : $rc_monthly_school_owner    → school_owner entitlement
 */

export type SubscriptionTier = 'owner_paid' | 'free';

export interface TierFeatures {
  canAddAdmins: boolean;
  canCustomizeBranding: boolean;
  canManagePermissions: boolean;
  maxAdmins: number;      // -1 = unlimited
  maxStudents: number;    // -1 = unlimited
  ownerPermissions: OwnerPermissions;
  studentPermissions: StudentPermissions;
}

export interface OwnerPermissions {
  viewMembers: boolean;
  editMembers: boolean;
  viewPayments: boolean;
  managePayments: boolean;
  createEvents: boolean;
  viewVideos: boolean;
  uploadVideos: boolean;
  manageChat: boolean;
}

export interface StudentPermissions {
  viewMembers: boolean;
  viewVideos: boolean;
  viewPayments: boolean;
  createEvents: boolean;
  uploadVideos: boolean;
  manageChat: boolean;
}

const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  owner_paid: {
    canAddAdmins: true,
    canCustomizeBranding: true,
    canManagePermissions: true,
    maxAdmins: -1,
    maxStudents: -1,
    ownerPermissions: {
      viewMembers: true,
      editMembers: true,
      viewPayments: true,
      managePayments: true,
      createEvents: true,
      viewVideos: true,
      uploadVideos: true,
      manageChat: true,
    },
    studentPermissions: {
      viewMembers: true,
      viewVideos: true,
      viewPayments: false,
      createEvents: false,
      uploadVideos: false,
      manageChat: false,
    },
  },
  free: {
    canAddAdmins: false,
    canCustomizeBranding: false,
    canManagePermissions: false,
    maxAdmins: 0,
    maxStudents: -1,
    ownerPermissions: {
      viewMembers: true,
      editMembers: false,
      viewPayments: false,
      managePayments: false,
      createEvents: false,
      viewVideos: true,
      uploadVideos: false,
      manageChat: false,
    },
    studentPermissions: {
      viewMembers: true,
      viewVideos: true,
      viewPayments: false,
      createEvents: false,
      uploadVideos: false,
      manageChat: false,
    },
  },
};

export const getTierFeatures = (tier: SubscriptionTier): TierFeatures =>
  TIER_FEATURES[tier];

export const hasFeature = (
  tier: SubscriptionTier,
  feature: keyof TierFeatures,
): boolean => {
  const features = TIER_FEATURES[tier];
  const value = features[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return true;
};

// ─── RevenueCat constants ─────────────────────────────────────────────────────

/** Teacher/Owner plan — $9.99/month */
export const RC_TEACHER_PACKAGE_ID = '$rc_monthly_owner_teacher';
export const RC_TEACHER_ENTITLEMENT_ID = 'school_owner_teacher';
export const TEACHER_PRICE_FALLBACK = '$9.99';

/** Admin plan — $6.99/month */
export const RC_ADMIN_PACKAGE_ID = '$rc_monthly_school_owner';
export const RC_ADMIN_ENTITLEMENT_ID = 'school_owner';
export const ADMIN_PRICE_FALLBACK = '$6.99';

/** @deprecated Use RC_TEACHER_PACKAGE_ID / RC_ADMIN_PACKAGE_ID */
export const RC_PACKAGE_ID = RC_ADMIN_PACKAGE_ID;
/** @deprecated Use RC_TEACHER_ENTITLEMENT_ID / RC_ADMIN_ENTITLEMENT_ID */
export const RC_ENTITLEMENT_ID = RC_ADMIN_ENTITLEMENT_ID;
/** @deprecated Use TEACHER_PRICE_FALLBACK / ADMIN_PRICE_FALLBACK */
export const OWNER_PRICE_FALLBACK = ADMIN_PRICE_FALLBACK;

// ─── Display info ─────────────────────────────────────────────────────────────

export const SUBSCRIPTION_TIERS = {
  /** Teacher / Instructor — $9.99/month, full ownership privileges */
  owner_teacher: {
    id: 'owner_teacher',
    name: 'School Owner',
    price: TEACHER_PRICE_FALLBACK,
    period: '/month',
    description: 'Everything you need to run your halau',
    features: [
      'Unlimited students & members',
      'Member management & approvals',
      'Event creation & RSVP tracking',
      'Video library & uploads',
      'Financial dues & payments',
      'Chat channels & announcements',
      'Digital waivers & documents',
      'Admin roles & permissions',
      'Custom school branding',
    ],
  },
  /** Admin role — $6.99/month, management privileges without ownership */
  owner_admin: {
    id: 'owner_admin',
    name: 'School Admin',
    price: ADMIN_PRICE_FALLBACK,
    period: '/month',
    description: 'Full admin access to manage your halau',
    features: [
      'Unlimited students & members',
      'Member management & approvals',
      'Event creation & RSVP tracking',
      'Video library & uploads',
      'Financial dues & payments',
      'Chat channels & announcements',
      'Digital waivers & documents',
      'Admin roles & permissions',
    ],
  },
  /** @deprecated legacy key kept for backward compat */
  owner_paid: {
    id: 'owner_paid',
    name: 'School Owner',
    price: TEACHER_PRICE_FALLBACK,
    period: '/month',
    description: 'Everything you need to run your halau',
    features: [
      'Unlimited students & members',
      'Member management & approvals',
      'Event creation & RSVP tracking',
      'Video library & uploads',
      'Financial dues & payments',
      'Chat channels & announcements',
      'Digital waivers & documents',
      'Admin roles & permissions',
      'Custom school branding',
    ],
  },
} as const;

export const STUDENT_TIER = {
  name: 'Student / Guardian',
  price: 'Free',
  description: 'Full access as a member of your halau',
  features: [
    'View members & events',
    'RSVP to events',
    'Watch videos',
    'Read chat messages',
    'View & sign waivers',
    'View payment status',
  ],
} as const;
