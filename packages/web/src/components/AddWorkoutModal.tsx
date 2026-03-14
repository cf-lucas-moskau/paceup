import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { PlannedWorkout } from '../lib/hooks';

const WORKOUT_TYPES = [
  'Easy Run',
  'Tempo Run',
  'Interval/Speed',
  'Long Run',
  'Recovery Run',
  'Race',
  'Cross-Training',
  'Rest Day',
];

interface AddWorkoutModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    workoutType: string;
    targetDistance: number | null;
    targetDuration: number | null;
    description: string | null;
  }) => void;
  editingWorkout?: PlannedWorkout | null;
  dayLabel: string;
}

export function AddWorkoutModal({
  open,
  onClose,
  onSubmit,
  editingWorkout,
  dayLabel,
}: AddWorkoutModalProps) {
  const [workoutType, setWorkoutType] = useState(editingWorkout?.workoutType || 'Easy Run');
  const [distanceKm, setDistanceKm] = useState(
    editingWorkout?.targetDistance ? (editingWorkout.targetDistance / 1000).toString() : ''
  );
  const [durationMin, setDurationMin] = useState(
    editingWorkout?.targetDuration ? (editingWorkout.targetDuration / 60).toString() : ''
  );
  const [description, setDescription] = useState(editingWorkout?.description || '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      workoutType,
      targetDistance: distanceKm ? parseFloat(distanceKm) * 1000 : null,
      targetDuration: durationMin ? parseInt(durationMin) * 60 : null,
      description: description || null,
    });
    onClose();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-gray-900">
            {editingWorkout ? 'Edit Workout' : 'Add Workout'} — {dayLabel}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {WORKOUT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setWorkoutType(type)}
                    className={`rounded-md border px-3 py-2 text-sm transition ${
                      workoutType === type
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {workoutType !== 'Rest Day' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Distance (km)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="e.g. 10"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Duration (min)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={durationMin}
                      onChange={(e) => setDurationMin(e.target.value)}
                      placeholder="e.g. 60"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Easy pace, stay in Zone 2"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                {editingWorkout ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
