import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your email or mobile number').max(254),
  password: z.string().min(1, 'Enter your password').max(128),
  clientType: z.enum(['web', 'mobile', 'integration']).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters')
    .max(128)
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
});
