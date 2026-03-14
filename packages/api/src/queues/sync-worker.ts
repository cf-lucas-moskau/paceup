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
      const { userId, afterTimestamp, page = 1 } = job.data;

      console.log(`Sync list page ${page} for user ${userId}`);
      await job.updateProgress({ userId, status: 'listing', page });

      const activities = await fetchAthleteActivities(
        userId,
        {
          after: afterTimestamp,
          page,
          perPage: 200,
        },
        'user'
      );

      if (activities.length === 0) {
        console.log(`Sync list complete for user ${userId} (no activities found)`);
        await prisma.user.update({
          where: { id: userId },
          data: { lastSyncAt: new Date() },
        });
        return { userId, total: 0 };
      }

      // Batch-check which activities already exist
      const stravaIds = activities.map((a) => BigInt(a.id));
      const existingActivities = await prisma.activity.findMany({
        where: { stravaActivityId: { in: stravaIds } },
        select: { stravaActivityId: true },
      });
      const existingSet = new Set(existingActivities.map((a) => a.stravaActivityId.toString()));

      // Enqueue detail-fetch jobs for new activities only
      let enqueued = 0;
      for (const activity of activities) {
        if (!existingSet.has(activity.id.toString())) {
          await activityQueue.add(
            `fetch-${activity.id}`,
            {
              userId,
              stravaActivityId: activity.id,
              action: 'fetch' as const,
              priority: 'user' as const,
            },
            {
              jobId: `fetch-${activity.id}`,
              priority: 2, // Medium priority for sync-triggered fetches
            }
          );
          enqueued++;
        }
      }

      await job.updateProgress({ userId, status: 'queued', total: enqueued, page });

      // If we got a full page (200), there might be more
      if (activities.length === 200) {
        const { syncListQueue } = await import('./index.js');
        await syncListQueue.add(
          `sync-${userId}-page-${page + 1}`,
          { userId, afterTimestamp, page: page + 1 },
          { jobId: `sync-${userId}-page-${page + 1}` }
        );
        console.log(`Sync list page ${page} done, continuing to page ${page + 1} (${enqueued} new activities)`);
      } else {
        console.log(`Sync list complete for user ${userId}: ${enqueued} new activities from ${activities.length} total`);
      }

      // Only update lastSyncAt on the final page — if page 2 fails,
      // the next sync will re-fetch from the correct point
      if (activities.length < 200) {
        await prisma.user.update({
          where: { id: userId },
          data: { lastSyncAt: new Date() },
        });
      }

      return { userId, total: enqueued };
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
