export const ATTENDANCE_STATES = {
  NOT_STARTED: 'not_started',
  CLOCKED_IN: 'clocked_in',
  ON_BREAK: 'on_break',
  CLOCKED_OUT: 'clocked_out',
} as const;

export type AttendanceState = (typeof ATTENDANCE_STATES)[keyof typeof ATTENDANCE_STATES];

export const ATTENDANCE_STATE_LABELS: Record<AttendanceState, string> = {
  not_started: 'Not Started',
  clocked_in: 'Working',
  on_break: 'On Break',
  clocked_out: 'Completed',
};

export const ATTENDANCE_STATE_COLORS: Record<AttendanceState, string> = {
  not_started: 'text-muted-foreground',
  clocked_in: 'text-emerald-500',
  on_break: 'text-amber-500',
  clocked_out: 'text-slate-400',
};

export const CORRECTION_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type CorrectionStatus = (typeof CORRECTION_STATUSES)[keyof typeof CORRECTION_STATUSES];

export const INVITATION_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
} as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[keyof typeof INVITATION_STATUSES];
