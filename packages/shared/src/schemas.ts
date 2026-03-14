import { z } from 'zod';

export const workoutTypeSchema = z.enum([
  'easy_run',
  'long_run',
  'tempo',
  'interval',
  'fartlek',
  'hill_repeats',
  'race',
  'cross_training',
  'rest',
  'walk',
  'other',
]);

export const groupRoleSchema = z.enum(['COACH', 'ATHLETE']);

export const unitPreferenceSchema = z.enum(['metric', 'imperial']);

export const createPlannedWorkoutSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  workoutType: workoutTypeSchema,
  targetDistance: z.number().positive().optional(),
  targetDuration: z.number().positive().optional(),
  description: z.string().max(500).optional(),
});

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const updateUserSettingsSchema = z.object({
  unitPreference: unitPreferenceSchema.optional(),
  timezone: z.string().optional(),
});
