import { useState, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { Navbar } from '../components/Navbar';
import { Button } from '../components/ui';
import { WorkoutCard } from '../components/WorkoutCard';
import { AddWorkoutModal } from '../components/AddWorkoutModal';
import {
  useWorkouts,
  useCreateWorkout,
  useUpdateWorkout,
  useDeleteWorkout,
  type PlannedWorkout,
} from '../lib/hooks';
import { getWeekStart, getWeekStartISO, formatDistance, formatDuration } from '../lib/date-utils';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Planner() {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekStart());
  const weekStartISO = getWeekStartISO(currentWeek);

  const { data, isLoading } = useWorkouts(weekStartISO);
  const createWorkout = useCreateWorkout();
  const updateWorkout = useUpdateWorkout();
  const deleteWorkout = useDeleteWorkout();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDay, setModalDay] = useState(0);
  const [editingWorkout, setEditingWorkout] = useState<PlannedWorkout | null>(null);

  // Group workouts by day
  const workoutsByDay = useMemo(() => {
    const map: Record<number, PlannedWorkout[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    if (data?.workouts) {
      for (const w of data.workouts) {
        if (map[w.dayOfWeek]) map[w.dayOfWeek].push(w);
      }
    }
    return map;
  }, [data]);

  // Weekly stats
  const weekStats = useMemo(() => {
    if (!data?.workouts) return { planned: 0, plannedDist: 0, actual: 0, actualDist: 0 };
    const workouts = data.workouts.filter((w) => w.workoutType !== 'Rest Day');
    const planned = workouts.length;
    const plannedDist = workouts.reduce((sum, w) => sum + (w.targetDistance || 0), 0);
    const matched = workouts.filter((w) => w.match);
    const actual = matched.length;
    const actualDist = matched.reduce((sum, w) => sum + (w.match?.activity.distance || 0), 0);
    return { planned, plannedDist, actual, actualDist };
  }, [data]);

  const compliancePct = weekStats.planned > 0 ? Math.round((weekStats.actual / weekStats.planned) * 100) : 0;

  function handleAddClick(dayOfWeek: number) {
    setEditingWorkout(null);
    setModalDay(dayOfWeek);
    setModalOpen(true);
  }

  function handleEditClick(workout: PlannedWorkout) {
    setEditingWorkout(workout);
    setModalDay(workout.dayOfWeek);
    setModalOpen(true);
  }

  function handleModalSubmit(workoutData: {
    workoutType: string;
    targetDistance: number | null;
    targetDuration: number | null;
    description: string | null;
  }) {
    if (editingWorkout) {
      updateWorkout.mutate({ id: editingWorkout.id, ...workoutData });
    } else {
      createWorkout.mutate({
        weekStartDate: weekStartISO,
        dayOfWeek: modalDay,
        ...workoutData,
      });
    }
  }

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neo-black">Training Plan</h1>
            <p className="mt-1 text-sm text-gray-500">
              Week of {format(currentWeek, 'MMMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigateWeek(-1)}>
              ← Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setCurrentWeek(getWeekStart())}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigateWeek(1)}>
              Next →
            </Button>
          </div>
        </div>

        {/* Weekly compliance bar */}
        {weekStats.planned > 0 && (
          <div className="neo-card mt-4 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Planned: <span className="font-mono font-bold text-neo-black">{weekStats.planned}</span> workouts / {formatDistance(weekStats.plannedDist)}
              </span>
              <span className="font-mono text-lg font-bold text-neo-black">{compliancePct}%</span>
              <span className="text-gray-500">
                Actual: <span className="font-mono font-bold text-neo-black">{weekStats.actual}</span> workouts / {formatDistance(weekStats.actualDist)}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-neo-black bg-gray-100">
              <div
                className={`h-full transition-all ${
                  compliancePct >= 90 ? 'bg-neo-green' :
                  compliancePct >= 75 ? 'bg-neo-yellow' :
                  compliancePct >= 50 ? 'bg-brand-500' : 'bg-neo-red'
                }`}
                style={{ width: `${Math.min(compliancePct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Week grid — 7 columns on desktop, vertical stack on mobile */}
        <div className="mt-6 grid gap-2 md:grid-cols-7">
          {DAY_LABELS.map((label, dayIndex) => {
            const dayDate = addDays(currentWeek, dayIndex);
            const isToday = format(new Date(), 'yyyy-MM-dd') === format(dayDate, 'yyyy-MM-dd');
            const dayWorkouts = workoutsByDay[dayIndex] || [];

            return (
              <div
                key={dayIndex}
                className={`min-h-[120px] rounded-xl border-3 p-2 md:min-h-[200px] ${
                  isToday
                    ? 'border-brand-500 bg-brand-50/30 shadow-neo-sm'
                    : 'border-neo-black bg-white'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? 'text-brand-500' : 'text-neo-black'
                      }`}
                    >
                      {label}
                    </span>
                    <span className="font-mono text-xs text-gray-400">
                      {format(dayDate, 'd')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleAddClick(dayIndex)}
                    className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-neo-black bg-neo-yellow text-neo-black transition-all hover:shadow-neo-sm active:translate-x-px active:translate-y-px active:shadow-none"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {isLoading ? (
                    <div className="h-12 animate-pulse rounded-lg bg-gray-100" />
                  ) : dayWorkouts.length > 0 ? (
                    dayWorkouts.map((workout) => (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        onEdit={handleEditClick}
                        onDelete={(id) => deleteWorkout.mutate(id)}
                      />
                    ))
                  ) : (
                    <p className="py-4 text-center text-[11px] text-gray-300">No workout</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unmatched activities */}
        {(data?.unmatchedActivities?.length ?? 0) > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-gray-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Unmatched Activities
              </span>
              <div className="h-px flex-1 bg-gray-300" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data!.unmatchedActivities.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-3 transition-colors hover:border-neo-black"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-neo-black">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(a.startDateLocal), 'EEE d MMM')} · {a.sportType}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-col items-end font-mono text-xs text-gray-500">
                    <span>{formatDistance(a.distance)}</span>
                    <span>{formatDuration(a.movingTime)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AddWorkoutModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        editingWorkout={editingWorkout}
        dayLabel={`${DAY_LABELS[modalDay]} ${format(addDays(currentWeek, modalDay), 'd MMM')}`}
      />
    </div>
  );
}
