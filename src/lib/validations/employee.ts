import { z } from 'zod';

export const inviteEmployeeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  fullName: z.string().optional(),
  role: z.enum(['admin', 'team_lead', 'employee']).default('employee'),
  teamId: z.string().uuid().optional(),
  position: z.string().optional(),
  scheduleId: z.string().uuid().optional(),
});

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  position: z.string().optional(),
  timezone: z.string(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
