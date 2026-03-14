import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../lib/auth';
import { useWorkouts, useActivities, useGroups } from '../lib/hooks';
import { getWeekStart, getWeekStartISO, formatDistance, formatPace } from '../lib/date-utils';
import { format } from 'date-fns';

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentWeek = getWeekStart();
  const weekStartISO = getWeekStartISO(currentWeek);
  const { data: workoutsData } = useWorkouts(weekStartISO);
  const { data: activitiesData } = useActivities(5);
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name?.split(' ')[0]}
        </h1>

        {/* Stats cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">This Week</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatDistance(actualDist)}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {completedWorkouts.length} of {plannedWorkouts.length} workouts
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Plan Compliance</h3>
            <p
              className={`mt-2 text-3xl font-bold ${
                plannedWorkouts.length === 0
                  ? 'text-gray-400'
                  : compliancePct >= 80
                    ? 'text-green-600'
                    : compliancePct >= 50
                      ? 'text-yellow-600'
                      : 'text-red-600'
              }`}
            >
              {plannedWorkouts.length > 0 ? `${compliancePct}%` : '—'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {plannedWorkouts.length > 0
                ? `${formatDistance(plannedDist)} planned`
                : 'No plan this week'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Groups</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{groups.length}</p>
            <p className="mt-1 text-sm text-gray-400">
              {groups.length > 0
                ? groups.map((g) => g.name).join(', ')
                : 'Join or create a group'}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Strava</h3>
            <p
              className={`mt-2 text-3xl font-bold ${
                user?.isConnected ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {user?.isConnected ? 'Connected' : 'Disconnected'}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {user?.isConnected ? 'Syncing activities' : 'Reconnect in settings'}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* This week's plan */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">This Week's Plan</h3>
              <button
                onClick={() => navigate('/planner')}
                className="text-sm text-brand-500 hover:text-brand-600"
              >
                View Planner →
              </button>
            </div>
            {plannedWorkouts.length === 0 ? (
              <div className="mt-4 py-6 text-center">
                <p className="text-gray-500">No plan this week</p>
                <button
                  onClick={() => navigate('/planner')}
                  className="mt-2 text-sm text-brand-500 hover:text-brand-600"
                >
                  Create one →
                </button>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {workouts.map((w) => (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between rounded-md px-3 py-2 ${
                      w.workoutType === 'Rest Day'
                        ? 'bg-gray-50 text-gray-400'
                        : w.match
                          ? 'bg-green-50 text-green-700'
                          : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][w.dayOfWeek]}
                      </span>
                      <span className="text-sm">{w.workoutType}</span>
                    </div>
                    <span className="text-xs">
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
          </div>

          {/* Recent activities */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent Activities</h3>
              <button
                onClick={() => navigate('/activities')}
                className="text-sm text-brand-500 hover:text-brand-600"
              >
                View All →
              </button>
            </div>
            {recentActivities.length === 0 ? (
              <div className="mt-4 py-6 text-center">
                <p className="text-gray-500">No activities yet</p>
                <p className="mt-1 text-sm text-gray-400">
                  Complete a workout on Strava and it'll appear here.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {recentActivities.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/activity/${a.id}`)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {a.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(a.startDateLocal), 'EEE, MMM d')}
                      </p>
                    </div>
                    <div className="flex gap-4 text-right text-xs text-gray-600">
                      <span>{formatDistance(a.distance)}</span>
                      <span>{formatPace(a.averageSpeed || 0)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">Powered by Strava</p>
      </main>
    </div>
  );
}
