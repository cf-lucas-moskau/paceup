import { useEffect, useState, useRef } from 'react';
import { useSyncStore, connectSync, disconnectSync } from '../lib/sync';

export function SyncStatusIndicator() {
  const [expanded, setExpanded] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const statuses = useSyncStore((s) => s.statuses);
  const isConnected = useSyncStore((s) => s.isConnected);

  useEffect(() => {
    connectSync();
    return () => disconnectSync();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  const syncingEntries = Object.entries(statuses).filter(
    ([, s]) => s.status === 'syncing'
  );
  const errorEntries = Object.entries(statuses).filter(
    ([, s]) => s.status === 'error'
  );

  const hasActivity = syncingEntries.length > 0 || errorEntries.length > 0;

  if (!isConnected && !hasActivity) {
    return null; // Don't show anything when disconnected and idle
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => hasActivity && setExpanded(!expanded)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-gray-100"
        aria-expanded={expanded}
        role="status"
        aria-live="polite"
      >
        {errorEntries.length > 0 ? (
          <>
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="hidden text-red-600 sm:inline">Sync error</span>
          </>
        ) : syncingEntries.length > 0 ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            <span className="hidden text-gray-600 sm:inline">
              {syncingEntries.length} syncing
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="hidden text-gray-500 sm:inline">Synced</span>
          </>
        )}
      </button>

      {expanded && hasActivity && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">
            Sync Status
          </p>
          <div className="space-y-2">
            {syncingEntries.map(([userId, status]) => (
              <div key={userId} className="text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span className="truncate">Syncing...</span>
                  {status.total ? (
                    <span className="text-xs text-gray-400">
                      {status.completed}/{status.total}
                    </span>
                  ) : null}
                </div>
                {status.total ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all"
                      style={{
                        width: `${Math.min(100, ((status.completed ?? 0) / status.total) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
            {errorEntries.map(([userId, status]) => (
              <div key={userId} className="text-sm text-red-600">
                {status.error || 'Sync failed'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
