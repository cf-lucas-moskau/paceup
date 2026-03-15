import { QueueEvents } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { sseManager } from './sync-status.js';

const DEBOUNCE_MS = 1_000; // Batch SSE updates: max 1 per second per user

// Per-user sync progress tracking
interface UserSyncProgress {
  totalEnqueued: number;
  activitiesCompleted: number;
  pagesCompleted: number;
  done: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

const syncProgress = new Map<string, UserSyncProgress>();

function getProgress(userId: string): UserSyncProgress {
  let p = syncProgress.get(userId);
  if (!p) {
    p = { totalEnqueued: 0, activitiesCompleted: 0, pagesCompleted: 0, done: false, timer: null };
    syncProgress.set(userId, p);
  }
  return p;
}

function scheduleBroadcast(userId: string): void {
  const p = getProgress(userId);
  if (p.timer) return; // Already scheduled

  p.timer = setTimeout(() => {
    p.timer = null;
    const progress = syncProgress.get(userId);
    if (!progress) return;

    sseManager.broadcastToGroupMembers(userId, 'sync-progress', {
      userId,
      status: 'syncing',
      activitiesCompleted: progress.activitiesCompleted,
      totalEnqueued: progress.totalEnqueued,
      pagesCompleted: progress.pagesCompleted,
      listingDone: progress.done,
    }).catch((err) => console.error('SSE broadcast error:', err));
  }, DEBOUNCE_MS);
}

let activityEvents: QueueEvents | null = null;
let syncListEvents: QueueEvents | null = null;

export function startSyncEvents(): void {
  activityEvents = new QueueEvents('activity-sync', { connection: redisConnection });
  syncListEvents = new QueueEvents('sync-list', { connection: redisConnection });

  // Activity detail-fetch progress — update counters, never fire sync-complete
  activityEvents.on('progress', ({ data }) => {
    const progress = data as { userId?: string; status?: string; stravaActivityId?: number };
    if (!progress.userId) return;

    if (progress.status === 'complete') {
      const p = getProgress(progress.userId);
      p.activitiesCompleted++;
      scheduleBroadcast(progress.userId);

      // If listing is done and all enqueued activities are fetched, sync is truly complete
      if (p.done && p.activitiesCompleted >= p.totalEnqueued) {
        // Clear debounce timer and send final event
        if (p.timer) { clearTimeout(p.timer); p.timer = null; }
        syncProgress.delete(progress.userId);
        sseManager.broadcastToGroupMembers(progress.userId, 'sync-complete', {
          userId: progress.userId,
          activitiesCompleted: p.activitiesCompleted,
        }).catch((err) => console.error('SSE broadcast error:', err));
      }
    } else {
      // 'fetching' status — just schedule a progress broadcast
      scheduleBroadcast(progress.userId);
    }
  });

  activityEvents.on('failed', ({ failedReason }) => {
    console.error('Activity sync job failed:', failedReason);
  });

  // Sync-list page progress — listing phase
  syncListEvents.on('progress', ({ data }) => {
    const progress = data as { userId?: string; page?: number; total?: number; status?: string };
    if (!progress.userId) return;

    const p = getProgress(progress.userId);
    // Immediate broadcast for listing status (user should see "Discovering activities...")
    sseManager.broadcastToGroupMembers(progress.userId, 'sync-progress', {
      userId: progress.userId,
      status: 'syncing',
      activitiesCompleted: p.activitiesCompleted,
      totalEnqueued: p.totalEnqueued,
      pagesCompleted: p.pagesCompleted,
      phase: progress.status === 'listing' ? 'listing' : 'queuing',
      page: progress.page,
    }).catch((err) => console.error('SSE broadcast error:', err));
  });

  // Sync-list page completed — accumulate totals, only broadcast sync-complete on final page
  syncListEvents.on('completed', ({ returnvalue }) => {
    try {
      const rv = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
      if (!rv?.userId) return;

      const p = getProgress(rv.userId);
      p.totalEnqueued += rv.total ?? 0;
      p.pagesCompleted++;

      if (rv.done) {
        p.done = true;
        // If no activities were enqueued at all, sync is immediately complete
        if (p.totalEnqueued === 0) {
          if (p.timer) { clearTimeout(p.timer); p.timer = null; }
          syncProgress.delete(rv.userId);
          sseManager.broadcastToGroupMembers(rv.userId, 'sync-complete', {
            userId: rv.userId,
            activitiesCompleted: 0,
          }).catch((err) => console.error('SSE broadcast error:', err));
        } else {
          // Activities still being fetched — send progress update
          scheduleBroadcast(rv.userId);
        }
      } else {
        // More pages coming — send progress update
        scheduleBroadcast(rv.userId);
      }
    } catch (err) {
      console.warn('Failed to parse sync-list completed returnvalue:', err);
    }
  });

  console.log('QueueEvents listeners started');
}

export async function stopSyncEvents(): Promise<void> {
  // Clear all pending debounce timers
  for (const p of syncProgress.values()) {
    if (p.timer) clearTimeout(p.timer);
  }
  syncProgress.clear();

  if (activityEvents) {
    await activityEvents.close();
    activityEvents = null;
  }
  if (syncListEvents) {
    await syncListEvents.close();
    syncListEvents = null;
  }
}
