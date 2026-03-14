import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

// --- Workout hooks ---

export interface PlannedWorkout {
  id: string;
  userId: string;
  weekStartDate: string;
  dayOfWeek: number;
  workoutType: string;
  targetDistance: number | null;
  targetDuration: number | null;
  description: string | null;
  assignedByUserId: string | null;
  assignedBy: { id: string; name: string } | null;
  match: {
    id: string;
    confidence: number;
    isManualOverride: boolean;
    activity: {
      id: string;
      name: string;
      sportType: string;
      distance: number;
      movingTime: number;
      startDateLocal: string;
    };
  } | null;
}

export function useWorkouts(weekStart: string) {
  return useQuery({
    queryKey: ['workouts', weekStart],
    queryFn: () =>
      apiFetch<{ workouts: PlannedWorkout[] }>(`/workouts?weekStart=${weekStart}`),
    enabled: !!weekStart,
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      weekStartDate: string;
      dayOfWeek: number;
      workoutType: string;
      targetDistance?: number | null;
      targetDuration?: number | null;
      description?: string | null;
    }) => apiFetch('/workouts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

export function useUpdateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) =>
      apiFetch(`/workouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/workouts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

// --- Activity hooks ---

export interface ActivitySummary {
  id: string;
  stravaActivityId: string;
  name: string;
  sportType: string;
  distance: number;
  movingTime: number;
  elapsedTime: number;
  totalElevationGain: number;
  startDate: string;
  startDateLocal: string;
  timezone: string | null;
  summaryPolyline: string | null;
  averageSpeed: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  hasHeartrate: boolean;
  calories: number | null;
  isPrivate: boolean;
  match: {
    id: string;
    confidence: number;
    isManualOverride: boolean;
    plannedWorkout: {
      id: string;
      workoutType: string;
      targetDistance: number | null;
      targetDuration: number | null;
    };
  } | null;
}

export interface ActivityDetail extends ActivitySummary {
  rawData: unknown;
  streams: {
    id: string;
    streamType: string;
    data: unknown;
  }[];
}

export function useActivities() {
  return useInfiniteQuery({
    queryKey: ['activities'],
    queryFn: ({ pageParam }) =>
      apiFetch<{ activities: ActivitySummary[]; nextCursor: string | null }>(
        `/activities?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: () => apiFetch<{ activity: ActivityDetail }>(`/activities/${id}`),
    enabled: !!id,
  });
}

// --- Settings hooks ---

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { unitPreference?: string; timezone?: string }) =>
      apiFetch('/settings', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
