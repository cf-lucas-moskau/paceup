-- Add lastSyncAt to User for stale-based sync triggering
ALTER TABLE "User" ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- Add sortOrder to PlannedWorkout for ordering multiple workouts on the same day
ALTER TABLE "PlannedWorkout" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Drop the unique constraint that limits one workout per day
DROP INDEX "PlannedWorkout_userId_weekStartDate_dayOfWeek_key";

-- Add non-unique index for query performance (replaces the dropped unique index)
CREATE INDEX "PlannedWorkout_userId_weekStartDate_dayOfWeek_idx"
  ON "PlannedWorkout"("userId", "weekStartDate", "dayOfWeek");
