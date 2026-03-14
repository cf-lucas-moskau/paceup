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

export function useActivities(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['activities', limit],
    queryFn: ({ pageParam }) =>
      apiFetch<{ activities: ActivitySummary[]; nextCursor: string | null }>(
        `/activities?limit=${limit}${pageParam ? `&cursor=${pageParam}` : ''}`
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

// --- Group hooks ---

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  role: string;
  memberCount: number;
  joinedAt: string;
}

export interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  members: GroupMember[];
  invites?: { id: string; code: string; expiresAt: string; useCount: number; maxUses: number }[];
}

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<{ groups: GroupSummary[] }>('/groups'),
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => apiFetch<{ group: GroupDetail; userRole: string }>(`/groups/${groupId}`),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiFetch('/groups', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useJoinGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch(`/groups/join/${code}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

export function useCreateInvite(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { maxUses?: number; expiresInHours?: number }) =>
      apiFetch(`/groups/${groupId}/invites`, { method: 'POST', body: JSON.stringify(data || {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useUpdateMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      apiFetch(`/groups/${groupId}/members/${memberId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}

// --- Group Training hooks ---

export interface MemberTraining {
  user: { id: string; name: string; avatarUrl: string | null };
  role: string;
  workouts: {
    id: string;
    dayOfWeek: number;
    workoutType: string;
    targetDistance: number | null;
    targetDuration?: number | null;
    description?: string | null;
    isCompleted?: boolean;
    match?: {
      confidence: number;
      activity: {
        id: string;
        name: string;
        sportType: string;
        distance: number;
        movingTime: number;
      };
    } | null;
  }[];
  stats: { planned: number; completed: number; compliancePct: number };
}

export function useGroupTraining(groupId: string, weekStart: string) {
  return useQuery({
    queryKey: ['group-training', groupId, weekStart],
    queryFn: () =>
      apiFetch<{ memberTraining: MemberTraining[]; userRole: string }>(
        `/groups/${groupId}/training?weekStart=${weekStart}`
      ),
    enabled: !!groupId && !!weekStart,
  });
}

// --- Feed hooks ---

export interface FeedActivity {
  id: string;
  stravaActivityId: string;
  name: string;
  sportType: string;
  distance: number;
  movingTime: number;
  startDateLocal: string;
  summaryPolyline: string | null;
  averageSpeed: number | null;
  hasHeartrate: boolean;
  user: { id: string; name: string; avatarUrl: string | null };
  match: { confidence: number } | null;
}

export function useFeed(groupId?: string) {
  return useInfiniteQuery({
    queryKey: ['feed', groupId],
    queryFn: ({ pageParam }) =>
      apiFetch<{ activities: FeedActivity[]; nextCursor: string | null }>(
        `/feed?limit=20${pageParam ? `&cursor=${pageParam}` : ''}${groupId ? `&groupId=${groupId}` : ''}`
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// --- Notification hooks ---

export interface Notification {
  id: string;
  type: string;
  message: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiFetch<{ notifications: Notification[]; unreadCount: number }>('/notifications'),
    refetchInterval: 60000, // Poll every minute
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${id}/read`, { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/notifications/read-all', { method: 'PUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
