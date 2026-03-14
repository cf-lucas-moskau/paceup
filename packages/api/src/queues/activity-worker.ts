import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { fetchActivity, StravaApiError } from '../lib/strava-api.js';
import type { ActivitySyncJobData } from './index.js';

function processActivityWorker() {
  const worker = new Worker<ActivitySyncJobData>(
    'activity-sync',
    async (job: Job<ActivitySyncJobData>) => {
      const { userId, stravaActivityId, priority } = job.data;

      console.log(`Syncing activity ${stravaActivityId} for user ${userId}`);

      const stravaActivity = await fetchActivity(userId, stravaActivityId, priority);

      await prisma.activity.upsert({
        where: { stravaActivityId: BigInt(stravaActivity.id) },
        update: {
          name: stravaActivity.name,
          sportType: stravaActivity.sport_type,
          distance: stravaActivity.distance,
          movingTime: stravaActivity.moving_time,
          elapsedTime: stravaActivity.elapsed_time,
          totalElevationGain: stravaActivity.total_elevation_gain,
          startDate: new Date(stravaActivity.start_date),
          startDateLocal: new Date(stravaActivity.start_date_local),
          timezone: stravaActivity.timezone,
          summaryPolyline: stravaActivity.map?.summary_polyline ?? null,
          averageSpeed: stravaActivity.average_speed,
          maxSpeed: stravaActivity.max_speed,
          averageHeartrate: stravaActivity.average_heartrate ?? null,
          maxHeartrate: stravaActivity.max_heartrate ?? null,
          hasHeartrate: stravaActivity.has_heartrate,
          sufferScore: stravaActivity.suffer_score ?? null,
          calories: stravaActivity.calories ?? null,
          isPrivate: stravaActivity.private,
          isManual: stravaActivity.manual,
          rawData: JSON.parse(JSON.stringify(stravaActivity)),
        },
        create: {
          stravaActivityId: BigInt(stravaActivity.id),
          userId,
          name: stravaActivity.name,
          sportType: stravaActivity.sport_type,
          distance: stravaActivity.distance,
          movingTime: stravaActivity.moving_time,
          elapsedTime: stravaActivity.elapsed_time,
          totalElevationGain: stravaActivity.total_elevation_gain,
          startDate: new Date(stravaActivity.start_date),
          startDateLocal: new Date(stravaActivity.start_date_local),
          timezone: stravaActivity.timezone,
          summaryPolyline: stravaActivity.map?.summary_polyline ?? null,
          averageSpeed: stravaActivity.average_speed,
          maxSpeed: stravaActivity.max_speed,
          averageHeartrate: stravaActivity.average_heartrate ?? null,
          maxHeartrate: stravaActivity.max_heartrate ?? null,
          hasHeartrate: stravaActivity.has_heartrate,
          sufferScore: stravaActivity.suffer_score ?? null,
          calories: stravaActivity.calories ?? null,
          isPrivate: stravaActivity.private,
          isManual: stravaActivity.manual,
          rawData: JSON.parse(JSON.stringify(stravaActivity)),
        },
      });

      console.log(`Activity ${stravaActivityId} synced successfully`);
    },
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000, // max 10 jobs per minute
      },
    }
  );

  worker.on('failed', (job, err) => {
    if (err instanceof StravaApiError && err.status === 429) {
      console.warn(`Rate limited on activity sync job ${job?.id}, will retry`);
    } else {
      console.error(`Activity sync job ${job?.id} failed:`, err.message);
    }
  });

  return worker;
}

export { processActivityWorker };
