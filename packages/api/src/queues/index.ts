import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis.js';

export const activityQueue = new Queue('activity-sync', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const backfillQueue = new Queue('activity-backfill', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export interface ActivitySyncJobData {
  userId: string;
  stravaActivityId: number;
  action: 'fetch' | 'update';
  priority: 'webhook' | 'user';
}

export interface BackfillJobData {
  userId: string;
  page: number;
  afterTimestamp?: number;
}
