import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useActivities } from '../lib/hooks';
import { formatDistance, formatDuration, formatPace } from '../lib/date-utils';
import { format } from 'date-fns';

export function Activities() {
  const navigate = useNavigate();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useActivities();

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>

        <div className="mt-6 space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200" />
            ))
          ) : activities.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No activities yet.</p>
              <p className="mt-1 text-sm text-gray-400">
                Complete a workout on Strava and it'll appear here.
              </p>
            </div>
          ) : (
            activities.map((activity) => (
              <button
                key={activity.id}
                onClick={() => navigate(`/activity/${activity.id}`)}
                className="flex w-full items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <SportIcon sportType={activity.sportType} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{activity.name}</p>
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
              className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
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
  // Simple running icon for running types, generic for others
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
