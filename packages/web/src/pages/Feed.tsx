import { Navbar } from '../components/Navbar';
import { useFeed, useGroups } from '../lib/hooks';
import { formatDistance, formatDuration, formatPace } from '../lib/date-utils';
import { format } from 'date-fns';
import { useState } from 'react';

export function Feed() {
  const [groupFilter, setGroupFilter] = useState<string>();
  const { data: groupsData } = useGroups();
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useFeed(groupFilter);

  const activities = data?.pages.flatMap((p) => p.activities) ?? [];
  const groups = groupsData?.groups ?? [];

  return (
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Activity Feed</h1>
          {groups.length > 0 && (
            <select
              value={groupFilter || ''}
              onChange={(e) => setGroupFilter(e.target.value || undefined)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="">All Groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-gray-200" />
            ))
          ) : activities.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-gray-500">No activities in your feed yet.</p>
              <p className="mt-1 text-sm text-gray-400">
                Join a group to see your friends' activities.
              </p>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  {activity.user.avatarUrl ? (
                    <img
                      src={activity.user.avatarUrl}
                      alt={activity.user.name}
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                      {activity.user.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.user.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(activity.startDateLocal), 'EEE, MMM d · h:mm a')}
                      {' · '}
                      {activity.sportType}
                    </p>
                  </div>
                </div>

                {/* Activity name */}
                <p className="mt-2 font-medium text-gray-900">{activity.name}</p>

                {/* Stats */}
                <div className="mt-2 flex gap-6">
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
              </div>
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
