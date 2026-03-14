import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useActivities } from '../lib/hooks';
import type { ActivityFilters } from '../lib/hooks';
import { formatDistance, formatDuration, formatPace } from '../lib/date-utils';
import { format } from 'date-fns';

const SPORT_OPTIONS = [
  { value: '', label: 'All Sports' },
  { value: 'Run', label: 'Run' },
  { value: 'TrailRun', label: 'Trail Run' },
  { value: 'VirtualRun', label: 'Virtual Run' },
  { value: 'Ride', label: 'Ride' },
  { value: 'Swim', label: 'Swim' },
  { value: 'Walk', label: 'Walk' },
  { value: 'Hike', label: 'Hike' },
];

export function Activities() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filters from URL
  const q = searchParams.get('q') || '';
  const sport = searchParams.get('sport') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  // Local search input state (debounced before writing to URL)
  const [searchInput, setSearchInput] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync local input when URL changes (e.g., browser back)
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Debounced search → URL
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (searchInput) {
          next.set('q', searchInput);
        } else {
          next.delete('q');
        }
        // Reset cursor when search changes
        next.delete('cursor');
        return next;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, setSearchParams]);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        next.delete('cursor');
        return next;
      }, { replace: true });
    },
    [setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
    setSearchInput('');
  }, [setSearchParams]);

  const hasFilters = q || sport || startDate || endDate;

  const filters: ActivityFilters | undefined = hasFilters
    ? { q: q || undefined, sport: sport || undefined, startDate: startDate || undefined, endDate: endDate || undefined }
    : undefined;

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useActivities(filters);

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  return (
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-neo-black">Activities</h1>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search activities..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="neo-input pl-9"
            />
          </div>

          {/* Sport filter */}
          <select
            value={sport}
            onChange={(e) => updateFilter('sport', e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {SPORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date range */}
          <input
            type="date"
            value={startDate ? startDate.split('T')[0] : ''}
            onChange={(e) => updateFilter('startDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="From"
          />
          <input
            type="date"
            value={endDate ? endDate.split('T')[0] : ''}
            onChange={(e) => updateFilter('endDate', e.target.value ? new Date(e.target.value).toISOString() : '')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="To"
          />

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="rounded-md px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* Activity list */}
        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
            ))
          ) : activities.length === 0 ? (
            <div className="py-12 text-center">
              {hasFilters ? (
                <>
                  <p className="text-gray-500">No activities match your filters.</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-sm text-brand-500 hover:text-brand-600"
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-500">No activities yet.</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Complete a workout on Strava and it'll appear here.
                  </p>
                </>
              )}
            </div>
          ) : (
            activities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => navigate(`/activity/${activity.id}`)}
                className="neo-card-hover flex w-full items-center gap-4 p-4 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-neo-black bg-brand-100 text-brand-600">
                  <SportIcon sportType={activity.sportType} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-neo-black">{activity.name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(activity.startDateLocal), 'EEE, MMM d · h:mm a')}
                  </p>
                </div>
                <div className="hidden gap-6 text-right sm:flex">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDistance(activity.distance)}
                    </p>
                    <p className="text-xs text-gray-400">Distance</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDuration(activity.movingTime)}
                    </p>
                    <p className="text-xs text-gray-400">Time</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatPace(activity.averageSpeed || 0)}
                    </p>
                    <p className="text-xs text-gray-400">Pace</p>
                  </div>
                </div>
                {activity.match && (
                  <span className="hidden rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 sm:block">
                    Matched
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {hasNextPage && (
          <div className="mt-6 text-center">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="neo-btn bg-white text-neo-black text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SportIcon({ sportType }: { sportType: string }) {
  const isRun = ['Run', 'TrailRun', 'VirtualRun'].includes(sportType);
  if (isRun) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
