import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSyncStore } from './sync';

/**
 * Watches Zustand sync store for sync-complete (syncing→idle transition)
 * and invalidates activity + workout queries. Since sync-complete now only
 * fires once per sync (not per page/activity), this won't cause flickering.
 */
export function useSyncInvalidation(): void {
  const queryClient = useQueryClient();
  const prevStatuses = useRef(useSyncStore.getState().statuses);

  useEffect(() => {
    const unsub = useSyncStore.subscribe((state) => {
      const prev = prevStatuses.current;
      prevStatuses.current = state.statuses;

      for (const [userId, status] of Object.entries(state.statuses)) {
        if (status.status === 'idle' && prev[userId]?.status === 'syncing') {
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['workouts'] });
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          break;
        }
      }
    });

    return unsub;
  }, [queryClient]);
}
