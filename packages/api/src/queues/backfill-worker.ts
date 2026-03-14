import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { fetchAthleteActivities, StravaApiError } from '../lib/strava-api.js';
import { activityQueue, backfillQueue } from './index.js';
import type { BackfillJobData } from './index.js';

function processBackfillWorker() {
  const worker = new Worker<BackfillJobData>(
    'activity-backfill',
    async (job: Job<BackfillJobData>) => {
      const { userId, page, afterTimestamp } = job.data;

      console.log(`Backfill page ${page} for user ${userId}`);

      const activities = await fetchAthleteActivities(
        userId,
        {
          after: afterTimestamp,
          page,
          perPage: 30,
        },
        'backfill'
      );

      if (activities.length === 0) {
        console.log(`Backfill complete for user ${userId} (no more activities)`);
        return;
      }

      // Enqueue individual activity fetch jobs for detailed data
      for (const activity of activities) {
        // Check if we already have this activity
        const existing = await prisma.activity.findUnique({
          where: { stravaActivityId: BigInt(activity.id) },
          select: { id: true },
        });

        if (!existing) {
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
              priority: 3, // Low priority for backfill
            }
          );
        }
      }

      // If we got a full page, there might be more — enqueue next page
      if (activities.length === 30) {
        await backfillQueue.add(
          `backfill-${userId}-page-${page + 1}`,
          {
            userId,
            page: page + 1,
            afterTimestamp,
          },
          {
            jobId: `backfill-${userId}-page-${page + 1}`,
            delay: 5000, // Small delay between pages to be gentle on rate limits
          }
        );
      } else {
        console.log(`Backfill complete for user ${userId} (${page} pages)`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 1, // One backfill at a time
      limiter: {
        max: 5,
        duration: 60_000, // max 5 backfill requests per minute
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (err instanceof StravaApiError && err.status === 429) {
      console.warn(`Rate limited on backfill job ${job?.id}, will retry`);
    } else {
      console.error(`Backfill job ${job?.id} failed:`, err.message);
    }
  });

  return worker;
}

export { processBackfillWorker };
