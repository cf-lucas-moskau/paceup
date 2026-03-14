import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlannedWorkout } from '../lib/hooks';
import { formatDistance, formatDuration } from '../lib/date-utils';

const WORKOUT_COLORS: Record<string, string> = {
  'Easy Run': 'bg-green-100 border-green-300 text-green-800',
  'Tempo Run': 'bg-orange-100 border-orange-300 text-orange-800',
  'Interval/Speed': 'bg-red-100 border-red-300 text-red-800',
  'Long Run': 'bg-blue-100 border-blue-300 text-blue-800',
  'Recovery Run': 'bg-teal-100 border-teal-300 text-teal-800',
  'Race': 'bg-purple-100 border-purple-300 text-purple-800',
  'Cross-Training': 'bg-yellow-100 border-yellow-300 text-yellow-800',
  'Rest Day': 'bg-gray-100 border-gray-300 text-gray-500',
};

const MATCH_COLORS: Record<string, string> = {
  high: 'border-l-green-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-orange-500',
  none: 'border-l-gray-300',
};

function getMatchLevel(confidence: number | undefined): string {
  if (!confidence) return 'none';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

interface WorkoutCardProps {
  workout: PlannedWorkout;
  onEdit: (workout: PlannedWorkout) => void;
  onDelete: (id: string) => void;
}

export function WorkoutCard({ workout, onEdit, onDelete }: WorkoutCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: workout.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const colorClass = WORKOUT_COLORS[workout.workoutType] || 'bg-gray-100 border-gray-300 text-gray-700';
  const matchLevel = getMatchLevel(workout.match?.confidence);
  const matchBorder = MATCH_COLORS[matchLevel];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group cursor-grab rounded-md border p-2 text-xs ${colorClass} border-l-4 ${matchBorder} active:cursor-grabbing`}
    >
      <div className="flex items-start justify-between">
        <span className="font-semibold">{workout.workoutType}</span>
        <div className="hidden gap-1 group-hover:flex">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(workout); }}
            className="rounded p-0.5 hover:bg-black/10"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(workout.id); }}
            className="rounded p-0.5 hover:bg-black/10"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {workout.targetDistance && (
        <div className="mt-1 text-[11px] opacity-75">
          {formatDistance(workout.targetDistance)}
        </div>
      )}
      {workout.targetDuration && !workout.targetDistance && (
        <div className="mt-1 text-[11px] opacity-75">
          {formatDuration(workout.targetDuration)}
        </div>
      )}

      {workout.match && (
        <div className="mt-1.5 rounded bg-white/60 px-1 py-0.5 text-[10px]">
          ✓ {workout.match.activity.name} — {formatDistance(workout.match.activity.distance)}
        </div>
      )}

      {workout.assignedBy && (
        <div className="mt-1 text-[10px] italic opacity-60">
          by {workout.assignedBy.name}
        </div>
      )}
    </div>
  );
}
