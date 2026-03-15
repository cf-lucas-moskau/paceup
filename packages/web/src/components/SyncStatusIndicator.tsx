import { useEffect } from 'react';
import { useSyncStore, connectSync, disconnectSync } from '../lib/sync';

export function SyncStatusIndicator() {
  const statuses = useSyncStore((s) => s.statuses);
  const isConnected = useSyncStore((s) => s.isConnected);

  useEffect(() => {
    connectSync();
    return () => disconnectSync();
  }, []);

  const syncingEntries = Object.entries(statuses).filter(
    ([, s]) => s.status === 'syncing'
  );
  const errorEntries = Object.entries(statuses).filter(
    ([, s]) => s.status === 'error'
  );

  const hasActivity = syncingEntries.length > 0 || errorEntries.length > 0;

  if (!isConnected && !hasActivity) {
    return null;
  }

  // Derive display text from the most relevant syncing entry
  const activeSyncStatus = syncingEntries[0]?.[1];
  let statusText = 'Syncing...';
  let progressPct: number | null = null;

  if (activeSyncStatus) {
    const { phase, activitiesCompleted = 0, totalEnqueued = 0, pagesCompleted = 0 } = activeSyncStatus;

    if (phase === 'listing') {
      statusText = pagesCompleted > 0
        ? `Discovering activities (page ${pagesCompleted + 1})...`
        : 'Discovering activities...';
    } else if (phase === 'fetching' && totalEnqueued > 0) {
      statusText = `Fetching ${activitiesCompleted}/${totalEnqueued}`;
      progressPct = Math.min(100, (activitiesCompleted / totalEnqueued) * 100);
    } else if (phase === 'queuing') {
      statusText = 'Queuing activities...';
    }
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm" role="status" aria-live="polite">
      {errorEntries.length > 0 ? (
        <>
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="hidden text-red-600 sm:inline">Sync error</span>
        </>
      ) : syncingEntries.length > 0 ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          <span className="hidden text-gray-600 sm:inline">{statusText}</span>
          {progressPct !== null && (
            <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 sm:block">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="hidden text-gray-500 sm:inline">Synced</span>
        </>
      )}
    </div>
  );
}
