/**
 * Reset all data for a user (or all users).
 * Usage: npx tsx src/scripts/reset-user-data.ts [userId]
 * If no userId is provided, resets all users.
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { activityQueue, syncListQueue } from '../queues/index.js';

async function resetUserData(userId?: string) {
  const where = userId ? { userId } : {};
  const userWhere = userId ? { id: userId } : {};

  console.log(userId ? `Resetting data for user ${userId}...` : 'Resetting data for ALL users...');

  // 1. Drain queued jobs
  console.log('  Draining activity-sync queue...');
  await activityQueue.drain();
  console.log('  Draining sync-list queue...');
  await syncListQueue.drain();

  // 2. Delete matches (through activity relation)
  const matchWhere = userId
    ? { activity: { userId } }
    : {};
  const matchCount = await prisma.activityMatch.deleteMany({ where: matchWhere });
  console.log(`  Deleted ${matchCount.count} activity matches`);

  // 3. Delete activities (cascades to ActivityStream)
  const activityCount = await prisma.activity.deleteMany({ where });
  console.log(`  Deleted ${activityCount.count} activities (streams cascaded)`);

  // 4. Delete planned workouts
  const workoutCount = await prisma.plannedWorkout.deleteMany({ where });
  console.log(`  Deleted ${workoutCount.count} planned workouts`);

  // 5. Clear lastSyncAt
  await prisma.user.updateMany({
    where: userWhere,
    data: { lastSyncAt: null },
  });
  console.log('  Cleared lastSyncAt');

  console.log('Done!');
}

const userId = process.argv[2];
resetUserData(userId)
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
