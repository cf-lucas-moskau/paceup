import { prisma } from './prisma.js';

/**
 * Activity-Plan Matching Engine
 *
 * Scoring: geometric mean of type, distance, and date scores.
 * Formula: typeScore^0.35 × distanceScore^0.35 × dateScore^0.30
 *
 * Confidence thresholds:
 *   ≥0.75 → auto-matched
 *   0.50-0.75 → likely match
 *   0.25-0.50 → possible match
 *   <0.25 → unmatched
 */

const RUNNING_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);
const CYCLING_TYPES = new Set(['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide']);
const SWIMMING_TYPES = new Set(['Swim']);
const WALKING_TYPES = new Set(['Walk', 'Hike']);

type SportCategory = 'running' | 'cycling' | 'swimming' | 'walking' | 'other';

function categorizeSport(sportType: string): SportCategory {
  if (RUNNING_TYPES.has(sportType)) return 'running';
  if (CYCLING_TYPES.has(sportType)) return 'cycling';
  if (SWIMMING_TYPES.has(sportType)) return 'swimming';
  if (WALKING_TYPES.has(sportType)) return 'walking';
  return 'other';
}

const RUNNING_WORKOUT_TYPES = new Set([
  'Easy Run', 'Tempo Run', 'Interval/Speed', 'Long Run', 'Recovery Run', 'Race',
]);

function computeTypeScore(sportType: string, workoutType: string): number {
  const category = categorizeSport(sportType);

  if (workoutType === 'Cross-Training') {
    return category === 'other' ? 0.7 : 0.5;
  }

  if (workoutType === 'Rest Day') return 0.0;

  if (RUNNING_WORKOUT_TYPES.has(workoutType)) {
    return category === 'running' ? 0.8 : 0.0;
  }

  // Fallback for custom types
  return 0.3;
}

function computeDistanceScore(
  actualDistance: number,
  targetDistance: number | null,
  actualDuration: number,
  targetDuration: number | null
): number {
  // Try distance first
  if (targetDistance && targetDistance > 0) {
    const ratio = actualDistance / targetDistance;
    if (ratio >= 0.85 && ratio <= 1.25) return 1.0;
    if (ratio >= 1.25 && ratio <= 1.50) return 0.8;
    if (ratio >= 0.70 && ratio <= 0.85) return 0.7;
    if (ratio < 0.50 || ratio > 2.0) return 0.0; // Too far off → no match
    return 0.5;
  }

  // Fall back to duration
  if (targetDuration && targetDuration > 0) {
    const ratio = actualDuration / targetDuration;
    if (ratio >= 0.85 && ratio <= 1.25) return 1.0;
    if (ratio >= 1.25 && ratio <= 1.50) return 0.8;
    if (ratio >= 0.70 && ratio <= 0.85) return 0.7;
    if (ratio < 0.50 || ratio > 2.0) return 0.0; // Too far off → no match
    return 0.5;
  }

  // No target → neutral score
  return 0.6;
}

function computeDateScore(daysDiff: number): number {
  if (daysDiff === 0) return 1.0;
  if (daysDiff === 1) return 0.6;
  if (daysDiff === 2) return 0.2;
  return 0.0;
}

function computeMatchScore(
  typeScore: number,
  distanceScore: number,
  dateScore: number
): number {
  // Geometric mean with weights: type^0.35 × distance^0.35 × date^0.30
  if (typeScore === 0 || distanceScore === 0 || dateScore === 0) return 0;
  return Math.pow(typeScore, 0.35) * Math.pow(distanceScore, 0.35) * Math.pow(dateScore, 0.30);
}

interface MatchCandidate {
  activityId: string;
  workoutId: string;
  score: number;
}

/**
 * Run matching for a specific user and week.
 * Finds unmatched activities and unmatched planned workouts, scores all pairs,
 * and greedily assigns best matches.
 */
export async function runMatchingForUser(
  userId: string,
  weekStartDate: Date
): Promise<void> {
  // Get the week's planned workouts that don't have a manual match
  const workouts = await prisma.plannedWorkout.findMany({
    where: {
      userId,
      weekStartDate,
      match: null, // No existing match
    },
  });

  if (workouts.length === 0) return;

  // Calculate the date range: weekStart - 1 day to weekEnd + 1 day
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const rangeStart = new Date(weekStart);
  rangeStart.setDate(rangeStart.getDate() - 1);
  const rangeEnd = new Date(weekEnd);
  rangeEnd.setDate(rangeEnd.getDate() + 1);

  // Get unmatched activities in the date range
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startDateLocal: {
        gte: rangeStart,
        lte: rangeEnd,
      },
      match: null, // No existing match
    },
  });

  if (activities.length === 0) return;

  // Score all candidate pairs
  const candidates: MatchCandidate[] = [];

  for (const activity of activities) {
    for (const workout of workouts) {
      // Calculate the planned date for this workout
      const plannedDate = new Date(weekStartDate);
      plannedDate.setDate(plannedDate.getDate() + workout.dayOfWeek);

      // Day difference
      const activityDate = new Date(activity.startDateLocal);
      const daysDiff = Math.abs(
        Math.round((activityDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24))
      );

      if (daysDiff > 2) continue; // Skip if too far apart

      const typeScore = computeTypeScore(activity.sportType, workout.workoutType);
      const distanceScore = computeDistanceScore(
        activity.distance,
        workout.targetDistance,
        activity.movingTime,
        workout.targetDuration
      );
      const dateScore = computeDateScore(daysDiff);
      const score = computeMatchScore(typeScore, distanceScore, dateScore);

      if (score > 0.1) {
        candidates.push({
          activityId: activity.id,
          workoutId: workout.id,
          score,
        });
      }
    }
  }

  // Sort by score descending, greedy assignment
  candidates.sort((a, b) => b.score - a.score);

  const matchedActivities = new Set<string>();
  const matchedWorkouts = new Set<string>();

  for (const candidate of candidates) {
    if (matchedActivities.has(candidate.activityId) || matchedWorkouts.has(candidate.workoutId)) {
      continue;
    }

    // Only auto-create matches above 0.25 threshold
    if (candidate.score >= 0.25) {
      await prisma.activityMatch.create({
        data: {
          activityId: candidate.activityId,
          plannedWorkoutId: candidate.workoutId,
          confidence: candidate.score,
          isManualOverride: false,
        },
      });

      matchedActivities.add(candidate.activityId);
      matchedWorkouts.add(candidate.workoutId);
    }
  }
}

/**
 * Run matching for a single activity (called after sync).
 */
export async function runMatchingForActivity(
  userId: string,
  activityId: string
): Promise<void> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { match: true },
  });

  if (!activity || activity.match) return; // Already matched

  // Find the week this activity falls in (Monday-based weeks)
  const actDate = new Date(activity.startDateLocal);
  const dayOfWeek = actDate.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(actDate);
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  await runMatchingForUser(userId, weekStart);
}
