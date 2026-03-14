export type WorkoutType =
  | 'easy_run'
  | 'long_run'
  | 'tempo'
  | 'interval'
  | 'fartlek'
  | 'hill_repeats'
  | 'race'
  | 'cross_training'
  | 'rest'
  | 'walk'
  | 'other';

export type GroupRole = 'COACH' | 'ATHLETE';

export type ActivityVisibility = 'PUBLIC' | 'GROUP_ONLY' | 'PRIVATE';

export type ConfidenceLevel = 'auto_matched' | 'likely_match' | 'possible_match' | 'unmatched';

export type ActivityCategory = 'running' | 'walking' | 'cycling' | 'swimming' | 'other_fitness';

export type UnitPreference = 'metric' | 'imperial';
