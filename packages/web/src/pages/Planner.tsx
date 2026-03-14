import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { format, addDays } from 'date-fns';
import { Navbar } from '../components/Navbar';
import { WorkoutCard } from '../components/WorkoutCard';
import { AddWorkoutModal } from '../components/AddWorkoutModal';
import {
  useWorkouts,
  useCreateWorkout,
  useUpdateWorkout,
  useDeleteWorkout,
  type PlannedWorkout,
} from '../lib/hooks';
import { getWeekStart, getWeekStartISO, formatDistance } from '../lib/date-utils';

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find which day the workout is being moved to
    const workout = data?.workouts.find((w) => w.id === active.id);
    if (!workout) return;

    // For now, reorder within the same day (DnD between days would need droppable zones)
    // Full cross-day DnD can be added with droppable day columns
  }

  function navigateWeek(direction: -1 | 1) {
    setCurrentWeek((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Training Plan</h1>
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

        {/* Weekly compliance bar */}
        {weekStats.planned > 0 && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Planned: {weekStats.planned} workouts / {formatDistance(weekStats.plannedDist)}
              </span>
              <span className="font-semibold text-gray-900">{compliancePct}% compliance</span>
              <span className="text-gray-600">
                Actual: {weekStats.actual} workouts / {formatDistance(weekStats.actualDist)}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full transition-all ${
                  compliancePct >= 90 ? 'bg-green-500' :
                  compliancePct >= 75 ? 'bg-yellow-500' :
                  compliancePct >= 50 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(compliancePct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Week grid */}
        <div className="mt-6 grid grid-cols-7 gap-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {DAY_LABELS.map((label, dayIndex) => {
              const dayDate = addDays(currentWeek, dayIndex);
              const isToday = format(new Date(), 'yyyy-MM-dd') === format(dayDate, 'yyyy-MM-dd');
              const dayWorkouts = workoutsByDay[dayIndex] || [];

              return (
                <div
                  key={dayIndex}
                  className={`min-h-[200px] rounded-lg border p-2 ${
                    isToday ? 'border-brand-400 bg-brand-50/30' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-semibold ${isToday ? 'text-brand-600' : 'text-gray-500'}`}>
                        {label}
                      </span>
                      <span className="ml-1 text-xs text-gray-400">
                        {format(dayDate, 'd')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAddClick(dayIndex)}
                      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  <SortableContext items={dayWorkouts.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {isLoading ? (
                        <div className="h-12 animate-pulse rounded bg-gray-100" />
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
                  </SortableContext>
                </div>
              );
            })}
          </DndContext>
        </div>
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
