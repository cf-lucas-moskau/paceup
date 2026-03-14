import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { Navbar } from '../components/Navbar';
import { useGroupTraining } from '../lib/hooks';
import { getWeekStart, getWeekStartISO, formatDistance } from '../lib/date-utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function GroupTraining() {
  const { groupId } = useParams<{ groupId: string }>();
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart());
  const weekStartISO = getWeekStartISO(currentWeek);

  const { data, isLoading } = useGroupTraining(groupId!, weekStartISO);

  function navigateWeek(direction: -1 | 1) {
    setCurrentWeek((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-neo-white pb-20 md:pb-0">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Group Training</h1>
            <p className="mt-1 text-sm text-gray-500">
              Week of {format(currentWeek, 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              ← Prev
            </button>
            <button
              onClick={() => setCurrentWeek(getWeekStart())}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek(1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Group stats */}
        {data?.memberTraining && (
          <div className="mt-4 flex gap-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {data.memberTraining.length}
              </p>
              <p className="text-xs text-gray-500">Athletes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(
                  data.memberTraining.reduce((s, m) => s + m.stats.compliancePct, 0) /
                    (data.memberTraining.length || 1)
                )}
                %
              </p>
              <p className="text-xs text-gray-500">Avg Compliance</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {data.memberTraining.reduce((s, m) => s + m.stats.completed, 0)}
                /
                {data.memberTraining.reduce((s, m) => s + m.stats.planned, 0)}
              </p>
              <p className="text-xs text-gray-500">Workouts Done</p>
            </div>
          </div>
        )}

        {/* Training grid: rows = members, columns = days */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className="w-40 border-b border-gray-200 pb-2 text-left text-xs font-semibold text-gray-500">
                  Athlete
                </th>
                {DAY_LABELS.map((label, i) => {
                  const dayDate = addDays(currentWeek, i);
                  const isToday =
                    format(new Date(), 'yyyy-MM-dd') === format(dayDate, 'yyyy-MM-dd');
                  return (
                    <th
                      key={i}
                      className={`border-b border-gray-200 pb-2 text-center text-xs font-semibold ${
                        isToday ? 'text-brand-600' : 'text-gray-500'
                      }`}
                    >
                      {label} {format(dayDate, 'd')}
                    </th>
                  );
                })}
                <th className="border-b border-gray-200 pb-2 text-center text-xs font-semibold text-gray-500">
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-2">
                      <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
                    </td>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="py-2 px-1">
                        <div className="h-8 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.memberTraining.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    No plans this week. Assign plans to your athletes to get started.
                  </td>
                </tr>
              ) : (
                data?.memberTraining.map((member) => (
                  <tr key={member.user.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {member.user.avatarUrl ? (
                          <img
                            src={member.user.avatarUrl}
                            alt={member.user.name}
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-medium text-gray-600">
                            {member.user.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                          {member.user.name}
                        </span>
                      </div>
                    </td>
                    {DAY_LABELS.map((_, dayIndex) => {
                      const workout = member.workouts.find(
                        (w) => w.dayOfWeek === dayIndex
                      );

                      if (!workout) {
                        return (
                          <td key={dayIndex} className="px-1 py-2 text-center">
                            <span className="text-xs text-gray-300">—</span>
                          </td>
                        );
                      }

                      const hasMatch =
                        'isCompleted' in workout
                          ? workout.isCompleted
                          : !!workout.match;

                      return (
                        <td key={dayIndex} className="px-1 py-2">
                          <div
                            className={`rounded-md px-1.5 py-1 text-center text-[11px] ${
                              workout.workoutType === 'Rest Day'
                                ? 'bg-gray-50 text-gray-400'
                                : hasMatch
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-orange-50 text-orange-700 border border-orange-200'
                            }`}
                          >
                            <div className="font-medium truncate">
                              {workout.workoutType === 'Rest Day'
                                ? 'Rest'
                                : workout.workoutType.replace(' Run', '')}
                            </div>
                            {workout.targetDistance && (
                              <div className="text-[10px] opacity-75">
                                {formatDistance(workout.targetDistance)}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-1 py-2 text-center">
                      <span
                        className={`text-sm font-semibold ${
                          member.stats.compliancePct >= 90
                            ? 'text-green-600'
                            : member.stats.compliancePct >= 50
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {member.stats.compliancePct}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
