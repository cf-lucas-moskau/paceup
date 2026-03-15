import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Card, Badge } from '../components/ui';
import { useAuth } from '../lib/auth';
import { useWorkouts, useActivities, useGroups, useTriggerSync } from '../lib/hooks';
import { getWeekStart, getWeekStartISO, formatDistance, formatPace } from '../lib/date-utils';
import { format } from 'date-fns';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const triggerSync = useTriggerSync();
  const hasSynced = useRef(false);

  // Trigger sync once per session, not on every mount/navigation
  useEffect(() => {
    if (user?.isConnected && !hasSynced.current) {
      hasSynced.current = true;
      triggerSync.mutate();
    }
  }, [user?.isConnected]);

  const currentWeek = getWeekStart();
  const weekStartISO = getWeekStartISO(currentWeek);
  const { data: workoutsData } = useWorkouts(weekStartISO);
  const { data: activitiesData } = useActivities(undefined, 5);
  const { data: groupsData } = useGroups();

  const workouts = workoutsData?.workouts ?? [];
  const recentActivities = activitiesData?.pages?.[0]?.activities?.slice(0, 5) ?? [];
  const groups = groupsData?.groups ?? [];

  // This week stats
  const plannedWorkouts = workouts.filter((w) => w.workoutType !== 'Rest Day');
  const completedWorkouts = plannedWorkouts.filter((w) => w.match);
  const plannedDist = plannedWorkouts.reduce((s, w) => s + (w.targetDistance || 0), 0);
  const actualDist = completedWorkouts.reduce(
    (s, w) => s + (w.match?.activity.distance || 0),
    0
  );
  const compliancePct =
    plannedWorkouts.length > 0
      ? Math.round((completedWorkouts.length / plannedWorkouts.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
        <h1 className="text-2xl font-bold text-neo-black sm:text-3xl">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>

        {/* Stats cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 lg:grid-cols-4">
          <Card className="!p-3 sm:!p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">This Week</h3>
            <p className="mt-1 font-mono text-xl font-bold text-neo-black sm:mt-2 sm:text-3xl">
              {formatDistance(actualDist)}
            </p>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              {completedWorkouts.length}/{plannedWorkouts.length} workouts
            </p>
          </Card>
          <Card className="!p-3 sm:!p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">Compliance</h3>
            <p
              className={`mt-1 font-mono text-xl font-bold sm:mt-2 sm:text-3xl ${
                plannedWorkouts.length === 0
                  ? 'text-gray-300'
                  : compliancePct >= 80
                    ? 'text-neo-green'
                    : compliancePct >= 50
                      ? 'text-neo-yellow'
                      : 'text-neo-red'
              }`}
            >
              {plannedWorkouts.length > 0 ? `${compliancePct}%` : '--'}
            </p>
            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              {plannedWorkouts.length > 0
                ? `${formatDistance(plannedDist)} planned`
                : 'No plan this week'}
            </p>
          </Card>
          <Card className="!p-3 sm:!p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">Groups</h3>
            <p className="mt-1 font-mono text-xl font-bold text-neo-black sm:mt-2 sm:text-3xl">{groups.length}</p>
            <p className="mt-1 truncate text-xs text-gray-500 sm:text-sm">
              {groups.length > 0
                ? groups.map((g) => g.name).join(', ')
                : 'Join or create a group'}
            </p>
          </Card>
          <Card className="!p-3 sm:!p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 sm:text-xs">Strava</h3>
            <div className="mt-1 flex items-center gap-2 sm:mt-2">
              <Badge color={user?.isConnected ? 'green' : 'red'}>
                {user?.isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-gray-500 sm:mt-2 sm:text-sm">
              {user?.isConnected ? 'Syncing activities' : 'Reconnect in settings'}
            </p>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 sm:mt-8 sm:gap-6 md:grid-cols-2">
          {/* This week's plan */}
          <Card className="min-w-0 !p-3 sm:!p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neo-black sm:text-base">This Week's Plan</h3>
              <button
                onClick={() => navigate('/planner')}
                className="text-xs font-semibold text-brand-500 hover:text-brand-600 sm:text-sm"
              >
                View Planner →
              </button>
            </div>
            {plannedWorkouts.length === 0 ? (
              <div className="mt-4 py-6 text-center">
                <p className="text-gray-400">No plan this week</p>
                <button
                  onClick={() => navigate('/planner')}
                  className="mt-2 text-sm font-semibold text-brand-500 hover:text-brand-600"
                >
                  Create one →
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-1.5 sm:space-y-2">
                {workouts.map((w) => (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between rounded-lg border-2 px-2 py-1.5 sm:px-3 sm:py-2 ${
                      w.workoutType === 'Rest Day'
                        ? 'border-gray-200 bg-gray-50 text-gray-400'
                        : w.match
                          ? 'border-neo-green bg-green-50 text-green-700'
                          : 'border-neo-yellow bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <span className="font-mono text-[10px] font-bold sm:text-xs">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][w.dayOfWeek]}
                      </span>
                      <span className="truncate text-xs font-medium sm:text-sm">{w.workoutType}</span>
                    </div>
                    <span className="ml-2 shrink-0 font-mono text-[10px] sm:text-xs">
                      {w.match
                        ? formatDistance(w.match.activity.distance)
                        : w.targetDistance
                          ? formatDistance(w.targetDistance)
                          : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent activities */}
          <Card className="min-w-0 !p-3 sm:!p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neo-black sm:text-base">Recent Activities</h3>
              <button
                onClick={() => navigate('/activities')}
                className="text-xs font-semibold text-brand-500 hover:text-brand-600 sm:text-sm"
              >
                View All →
              </button>
            </div>
            {recentActivities.length === 0 ? (
              <div className="mt-4 py-6 text-center">
                <p className="text-gray-400">No activities yet</p>
                <p className="mt-1 text-sm text-gray-400">
                  Complete a workout on Strava and it'll appear here.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-1.5 sm:space-y-2">
                {recentActivities.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/activity/${a.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border-2 border-gray-200 px-2 py-1.5 text-left transition-all hover:border-neo-black hover:shadow-neo-sm sm:px-3 sm:py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-neo-black sm:text-sm">
                        {a.name}
                      </p>
                      <p className="text-[10px] text-gray-400 sm:text-xs">
                        {format(new Date(a.startDateLocal), 'EEE, MMM d')}
                      </p>
                    </div>
                    <div className="ml-2 flex shrink-0 gap-2 text-right font-mono text-[10px] text-gray-500 sm:gap-4 sm:text-xs">
                      <span>{formatDistance(a.distance)}</span>
                      <span>{formatPace(a.averageSpeed || 0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">Powered by Strava</p>
      </main>
    </div>
  );
}
