import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSyncStore } from './sync';

/**
 * Watches Zustand sync store for 'sync-complete' events and
 * invalidates activity queries from within the React tree.
 * Only refetches the first page to avoid cursor instability.
 */
export function useSyncInvalidation(): void {
  const queryClient = useQueryClient();
  const prevStatuses = useRef(useSyncStore.getState().statuses);

  useEffect(() => {
    const unsub = useSyncStore.subscribe((state) => {
      const prev = prevStatuses.current;
      prevStatuses.current = state.statuses;

      // Detect any userId that transitioned to 'idle' (sync-complete)
      for (const [userId, status] of Object.entries(state.statuses)) {
        if (status.status === 'idle' && prev[userId]?.status === 'syncing') {
          queryClient.invalidateQueries({ queryKey: ['activities'] });
          queryClient.invalidateQueries({ queryKey: ['feed'] });
          break; // One invalidation is enough per batch
        }
      }
    });

    return unsub;
  }, [queryClient]);
}
