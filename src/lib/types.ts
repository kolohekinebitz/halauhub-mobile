// Core types for Halau Management App

export type UserRole = 'teacher' | 'instructor' | 'admin' | 'pending_admin' | 'student' | 'guardian';
export type MemberType = 'new' | 'returning';
export type MembershipPlan = 'monthly' | 'annual';
export type MemberStatus = 'pending' | 'approved' | 'denied';
export type PaymentMethod = 'venmo' | 'zelle' | 'cash' | 'check';
export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';
export type WaiverStatus = 'signed' | 'pending' | 'expired';
export type RSVPStatus = 'going' | 'maybe' | 'not_going' | 'pending';
export type ClassLevel = 'minor' | 'beginner' | 'intermediate' | 'advanced' | string;

// Custom class level for halau
export interface CustomClassLevel {
  id: string;
  value: string; // The internal identifier
  label: string; // Display name
  description?: string;
  order: number; // For sorting
}

// Custom title settings for halau
export interface HalauTitleSettings {
  teacherTitle: string; // Default: "Teacher"
  studentTitle: string; // Default: "Student"
  adminTitle: string;   // Default: "Admin"
  guardianTitle: string; // Default: "Parent/Guardian"
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  passwordHash: string;
  createdAt: string;
  emailVerified: boolean;
  resetToken?: string;
  resetTokenExpiry?: string;
}

export type InviteStatus = 'none' | 'pending' | 'accepted' | 'declined';
/** null = not relevant for students/guardians never in a billing flow */
export type PaymentResponsibility = 'self' | 'owner' | null;

export interface MemberSubscription {
  active: boolean;
  plan: 'owner_monthly' | 'admin_monthly' | null;
  /** 9.99 | 6.99 | 0 — always a number */
  price: number;
  renewalDate: string | null;  // ISO 8601
}

export interface Member {
  id: string;
  userId: string;
  halauId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto?: string;
  role: UserRole;
  memberType: MemberType;
  membershipPlan: MembershipPlan;
  status: MemberStatus;
  classLevel?: ClassLevel;
  isPaying?: boolean;
  joinedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  // Invite & promotion
  inviteStatus?: InviteStatus;
  /** uid of the owner who sent this member an admin invite */
  invitedBy?: string | null;
  paymentResponsibility?: PaymentResponsibility;
  /** Set to "absorbed" when the owner has directly paid for this admin seat. */
  billingStatus?: 'absorbed' | string;
  /** True when this admin seat has been paid for (by owner or self). */
  paid?: boolean;
  /** ISO 8601 — last time this member document was modified on the backend. */
  updatedAt?: string;
  /**
   * Monotonically increasing version counter — incremented by the backend on every write.
   * Used by safeMergeMember for deterministic conflict resolution.
   * 0 = legacy / unversioned record (never written by versioned backend code).
   * Client code MUST NEVER write this field.
   */
  version?: number;
  /** True during the 14-day free trial (teacher/owner only) */
  trialActive?: boolean;
  // Subscription (only set for teacher/admin roles)
  subscription?: MemberSubscription;
  // Keiki-specific fields
  isKeiki?: boolean;
  linkedToMemberId?: string;
  createdByMemberId?: string;
  // Manual pre-registration member (teacher added them before they signed up).
  // When true: userId is permitted to be '' (no Firebase account yet).
  // When false/absent: userId MUST be a non-empty Firebase UID.
  isManual?: boolean;
  // Privacy settings
  showEmailToMembers?: boolean;
  showPhoneToMembers?: boolean;
}

export interface Halau {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundPattern?: string;
  themeId?: string; // Reference to theme palette
  createdAt: string;
  createdBy: string;
  inviteCode: string;
  // Custom settings
  customClassLevels?: CustomClassLevel[];
  defaultClassLevelOverrides?: Record<string, { label?: string; description?: string }>; // Overrides for default levels (minor, beginner, intermediate, advanced)
  titleSettings?: HalauTitleSettings;
}

export interface HalauMembership {
  id: string;
  userId: string;
  halauId: string;
  role: UserRole;
  status: MemberStatus;
  joinedAt: string;
}

export interface Event {
  id: string;
  halauId: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  type: 'practice' | 'performance' | 'meeting' | 'workshop' | 'other';
  createdBy: string;
  createdAt: string;
  // Recurring event fields
  isRecurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurringEndDate?: string;
  recurringGroupId?: string; // Links all events in a recurring series
  isCancelled?: boolean;
  // Performance participant fields
  participantIds?: string[]; // Member IDs who are participating in the performance
}

export interface Attendance {
  id: string;
  eventId: string;
  memberId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  markedAt: string;
  markedBy: string;
}

export interface RSVP {
  id: string;
  eventId: string;
  memberId: string;
  status: RSVPStatus;
  updatedAt: string;
}

export interface Payment {
  id: string;
  halauId: string;
  memberId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  category: string;
  notes?: string;
  dueDate?: string;
  paidAt?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface Show {
  id: string;
  halauId: string;
  name: string;
  date: string;
  startTime: string;
  endTime?: string;
  location: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export interface ShowParticipation {
  id: string;
  showId: string;
  memberId: string;
  role?: string;
  addedAt: string;
}

export interface Video {
  id: string;
  halauId: string;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  category: 'practice' | 'performance' | 'technique' | 'other';
  uploadedBy: string;
  uploadedAt: string;
  accessRoles: UserRole[];
  videoDate?: string; // Date the video is relevant to (YYYY-MM-DD)
  accessClassLevels?: string[]; // Class level IDs/values that can view this video (empty/undefined = all)
}

export interface Waiver {
  id: string;
  halauId: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  expiresInDays?: number;
}

export interface WaiverSignature {
  id: string;
  waiverId: string;
  memberId: string;
  signedAt: string;
  signatureData: string;
  expiresAt?: string;
  status: WaiverStatus;
}

export interface ChatChannel {
  id: string;
  halauId: string;
  name: string;
  type: 'halau' | 'group' | 'show' | 'direct';
  description?: string;
  createdBy: string;
  createdAt: string;
  memberIds: string[];
  pinnedMessageIds?: string[]; // IDs of pinned messages
}

export interface MessageReaction {
  emoji: string;
  memberIds: string[];
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // member IDs who voted for this option
}

export interface MessagePoll {
  question: string;
  options: PollOption[];
  expiresAt?: string; // ISO date string for timed polls
  allowMultiple?: boolean;
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  text: string;
  sentAt: string;
  readBy: string[];
  attachment?: {
    type: 'image' | 'file';
    uri: string;
    name?: string;
  };
  mentions?: string[]; // member IDs mentioned in the message
  reactions?: MessageReaction[];
  poll?: MessagePoll;
  isPrivate?: boolean; // If true, only visible to sender and privateRecipients
  privateRecipients?: string[]; // member IDs who can see this private message
  replyToMessageId?: string; // ID of the message being replied to
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'event' | 'payment' | 'chat' | 'approval' | 'general';
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export type ParticipationType = 'paddler' | 'dancer' | 'both' | 'non_participant_supporter';
export type Gender = 'male' | 'female';

// Financial Management Types
export type DuesFrequency = 'one_time' | 'weekly' | 'monthly' | 'annually';
export type DuesCategory = 'school_dues' | 'performance_dues' | 'miscellaneous_dues' | 'overdue_expense' | 'custom';
export type FinancialStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'pending_approval' | 'approved' | 'released';

export interface OrganizationDues {
  id: string;
  halauId: string;
  name: string;
  amount: number;
  frequency: DuesFrequency;
  category: DuesCategory | string; // Allow custom category strings
  customCategory?: string; // Store custom category name
  description?: string;
  isActive: boolean;
  // Recurring payment fields
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'annually';

export interface MemberDue {
  id: string;
  halauId: string;
  memberId: string;
  duesId?: string; // Reference to OrganizationDues for recurring dues
  category: DuesCategory | string; // Allow custom category strings
  customCategory?: string; // Store custom category name
  name: string;
  amount: number;
  amountPaid: number;
  status: FinancialStatus;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  // Recurring payment fields
  isRecurring?: boolean;
  recurringFrequency?: RecurringFrequency;
  recurringDay?: number; // Day of week (0-6) for weekly, day of month (1-31) for monthly
  recurringEndDate?: string; // When to stop generating recurring dues
  recurringGroupId?: string; // Links all dues in a recurring series
}

export interface OverdueExpense {
  id: string;
  halauId: string;
  memberId: string; // Member who is owed money
  amount: number;
  description: string;
  category: string; // e.g., "Reimbursement", "Refund", etc.
  status: 'pending_approval' | 'approved' | 'released' | 'denied';
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  releasedAt?: string;
  notes?: string;
}

export interface FinancialTransaction {
  id: string;
  halauId: string;
  memberId: string;
  type: 'payment' | 'refund' | 'expense_release';
  amount: number;
  category: DuesCategory | string;
  method?: PaymentMethod;
  reference?: string; // MemberDue ID or OverdueExpense ID
  invoiceNumber?: string;
  notes?: string;
  processedBy: string;
  processedAt: string;
}

export interface PendingPaymentSubmission {
  id: string;
  halauId: string;
  memberId: string;
  memberDueId: string;
  amount: number;
  method: PaymentMethod;
  invoiceNumber?: string;
  notes?: string;
  submittedAt: string;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmedBy?: string;
  confirmedAt?: string;
  rejectionReason?: string;
}

export interface MemberRegistrationForm {
  id: string;
  memberId: string;
  halauId: string;
  firstName: string;
  lastName: string;
  memberType: MemberType;
  participationType: ParticipationType;
  gender: Gender;
  address: string;
  email: string;
  phoneNumber: string;
  phoneOptOut: boolean;
  emergencyContactFirstName: string;
  emergencyContactLastName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
  submittedAt: string;
}
