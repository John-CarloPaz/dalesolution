import { z } from 'zod';

export const clockInSchema = z.object({
  notes: z.string().optional(),
});

export const clockOutSchema = z.object({
  notes: z.string().optional(),
});

export const startBreakSchema = z.object({
  breakType: z.enum(['general', 'lunch', 'rest']).default('general'),
});

export const correctionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(10, 'Please provide a detailed reason'),
  requestedClockIn: z.string().datetime().optional(),
  requestedClockOut: z.string().datetime().optional(),
});

export const reviewCorrectionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  adminNotes: z.string().optional(),
});

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type StartBreakInput = z.infer<typeof startBreakSchema>;
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
export type ReviewCorrectionInput = z.infer<typeof reviewCorrectionSchema>;
