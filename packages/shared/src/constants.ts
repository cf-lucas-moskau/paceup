import type { ActivityCategory } from './types.js';

export const STRAVA_SPORT_TYPE_MAP: Record<string, ActivityCategory> = {
  Run: 'running',
  TrailRun: 'running',
  VirtualRun: 'running',
  Walk: 'walking',
  Hike: 'walking',
  Ride: 'cycling',
  VirtualRide: 'cycling',
  MountainBikeRide: 'cycling',
  GravelRide: 'cycling',
  EBikeRide: 'cycling',
  Swim: 'swimming',
};

export function categorizeStravaSportType(sportType: string): ActivityCategory {
  return STRAVA_SPORT_TYPE_MAP[sportType] ?? 'other_fitness';
}

export const WORKOUT_TYPE_LABELS: Record<string, string> = {
  easy_run: 'Easy Run',
  long_run: 'Long Run',
  tempo: 'Tempo',
  interval: 'Interval',
  fartlek: 'Fartlek',
  hill_repeats: 'Hill Repeats',
  race: 'Race',
  cross_training: 'Cross-Training',
  rest: 'Rest Day',
  walk: 'Walk',
  other: 'Other',
};

export const STRAVA_SCOPES = 'read,activity:read_all,profile:read_all';
export const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

export const RATE_LIMIT_15MIN = 200;
export const RATE_LIMIT_DAILY = 2000;
