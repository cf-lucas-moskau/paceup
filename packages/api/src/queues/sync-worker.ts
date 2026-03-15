import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { fetchAthleteActivities, StravaApiError } from '../lib/strava-api.js';
import { activityQueue } from './index.js';
import type { SyncListJobData } from './index.js';

function processSyncWorker() {
  const worker = new Worker<SyncListJobData>(
    'sync-list',
    async (job: Job<SyncListJobData>) => {
      const { userId, afterTimestamp, page = 1, maxActivities } = job.data;

      // Cap perPage to remaining budget when maxActivities is set
      const remaining = maxActivities ? maxActivities - (page - 1) * 200 : 200;
      const perPage = Math.min(200, Math.max(1, remaining));

      console.log(`Sync list page ${page} for user ${userId} (perPage=${perPage})`);
      await job.updateProgress({ userId, status: 'listing', page });

      const activities = await fetchAthleteActivities(
        userId,
        {
          after: afterTimestamp,
          page,
          perPage,
        },
        'user'
      );

      if (activities.length === 0) {
        console.log(`Sync list complete for user ${userId} (no activities found)`);
        await prisma.user.update({
          where: { id: userId },
          data: { lastSyncAt: new Date() },
        });
        return { userId, total: 0, done: true };
      }

      // Batch-check which activities already exist
      const stravaIds = activities.map((a) => BigInt(a.id));
      const existingActivities = await prisma.activity.findMany({
        where: { stravaActivityId: { in: stravaIds } },
        select: { stravaActivityId: true },
      });
      const existingSet = new Set(existingActivities.map((a) => a.stravaActivityId.toString()));

      // Enqueue detail-fetch jobs for new activities only (bulk add = 1 Redis round-trip)
      const jobsToAdd = activities
        .filter((a) => !existingSet.has(a.id.toString()))
        .map((activity) => ({
          name: `fetch-${activity.id}`,
          data: {
            userId,
            stravaActivityId: activity.id,
            action: 'fetch' as const,
            priority: 'user' as const,
          },
          opts: {
            jobId: `fetch-${activity.id}`,
            priority: 2, // Medium priority for sync-triggered fetches
          },
        }));

      if (jobsToAdd.length > 0) {
        await activityQueue.addBulk(jobsToAdd);
      }
      const enqueued = jobsToAdd.length;

      await job.updateProgress({ userId, status: 'queued', total: enqueued, page });

      // Check if we've hit the activity cap
      const totalFetched = (page - 1) * 200 + activities.length;
      const hitCap = maxActivities && totalFetched >= maxActivities;

      // If we got a full page (200) and haven't hit the cap, there might be more
      if (activities.length === 200 && !hitCap) {
        const { syncListQueue } = await import('./index.js');
        await syncListQueue.add(
          `sync-${userId}-page-${page + 1}`,
          { userId, afterTimestamp, page: page + 1, maxActivities },
          { jobId: `sync-${userId}-page-${page + 1}-${Date.now()}` }
        );
        console.log(`Sync list page ${page} done, continuing to page ${page + 1} (${enqueued} new activities)`);
      } else {
        const reason = hitCap ? `cap of ${maxActivities} reached` : `${activities.length} activities on last page`;
        console.log(`Sync list complete for user ${userId}: ${enqueued} new activities (${reason})`);
      }

      // Update lastSyncAt on the final page
      if (activities.length < 200 || hitCap) {
        await prisma.user.update({
          where: { id: userId },
          data: { lastSyncAt: new Date() },
        });
      }

      return { userId, total: enqueued, done: activities.length < 200 || !!hitCap };
    },
    {
      connection: redisConnection,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60_000, // max 5 list sync jobs per minute
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (err instanceof StravaApiError && err.status === 429) {
      console.warn(`Rate limited on sync list job ${job?.id}, will retry`);
    } else {
      console.error(`Sync list job ${job?.id} failed:`, err.message);
    }
  });

  return worker;
}

export { processSyncWorker };
