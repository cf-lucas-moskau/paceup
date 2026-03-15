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
    removeOnComplete: true,
    removeOnFail: { count: 5000 },
  },
});

export const syncListQueue = new Queue('sync-list', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 10000,
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

export interface SyncListJobData {
  userId: string;
  afterTimestamp?: number;
  page?: number;
  maxActivities?: number;
}
