import { QueueEvents } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
import { sseManager } from './sync-status.js';

const DEBOUNCE_MS = 1_000; // Batch SSE updates: max 1 per second per user

// Debounce buffer: userId → pending event data
const pendingEvents = new Map<string, { completed: number; total: number; type: string; timer: ReturnType<typeof setTimeout> }>();

let activityEvents: QueueEvents | null = null;
let syncListEvents: QueueEvents | null = null;

function debouncedBroadcast(userId: string, eventData: { completed: number; total: number; type: string }): void {
  const existing = pendingEvents.get(userId);

  if (existing) {
    // Update the pending data with latest counts
    existing.completed = eventData.completed;
    existing.total = Math.max(existing.total, eventData.total);
    existing.type = eventData.type;
    return; // Timer already running
  }

  // First event for this user — send immediately, then debounce subsequent
  sseManager.broadcastToGroupMembers(userId, 'sync-progress', {
    userId,
    status: 'syncing',
    completed: eventData.completed,
    total: eventData.total,
    type: eventData.type,
  }).catch((err) => console.error('SSE broadcast error:', err));

  const timer = setTimeout(() => {
    const pending = pendingEvents.get(userId);
    pendingEvents.delete(userId);
    if (pending) {
      sseManager.broadcastToGroupMembers(userId, 'sync-progress', {
        userId,
        status: 'syncing',
        completed: pending.completed,
        total: pending.total,
        type: pending.type,
      }).catch((err) => console.error('SSE broadcast error:', err));
    }
  }, DEBOUNCE_MS);

  pendingEvents.set(userId, { ...eventData, timer });
}

export function startSyncEvents(): void {
  activityEvents = new QueueEvents('activity-sync', { connection: redisConnection });
  syncListEvents = new QueueEvents('sync-list', { connection: redisConnection });

  activityEvents.on('progress', ({ data }) => {
    const progress = data as { userId?: string; status?: string; stravaActivityId?: number };
    if (!progress.userId) return;

    if (progress.status === 'complete') {
      sseManager.broadcastToGroupMembers(progress.userId, 'sync-complete', {
        userId: progress.userId,
        stravaActivityId: progress.stravaActivityId,
      }).catch((err) => console.error('SSE broadcast error:', err));
    } else {
      debouncedBroadcast(progress.userId, { completed: 0, total: 1, type: 'activity' });
    }
  });

  activityEvents.on('failed', ({ failedReason }) => {
    console.error('Activity sync job failed:', failedReason);
  });

  syncListEvents.on('progress', ({ data }) => {
    const progress = data as { userId?: string; page?: number; total?: number; status?: string };
    if (!progress.userId) return;

    debouncedBroadcast(progress.userId, {
      completed: 0,
      total: progress.total ?? 0,
      type: progress.status === 'listing' ? 'listing' : 'sync',
    });
  });

  syncListEvents.on('completed', ({ returnvalue }) => {
    try {
      const rv = typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
      if (rv?.userId) {
        sseManager.broadcastToGroupMembers(rv.userId, 'sync-complete', {
          userId: rv.userId,
          total: rv.total ?? 0,
          type: 'sync',
        }).catch((err) => console.error('SSE broadcast error:', err));
      }
    } catch (err) {
      console.warn('Failed to parse sync-list completed returnvalue:', err);
    }
  });

  console.log('QueueEvents listeners started');
}

export async function stopSyncEvents(): Promise<void> {
  // Clear all pending debounce timers
  for (const pending of pendingEvents.values()) {
    clearTimeout(pending.timer);
  }
  pendingEvents.clear();

  if (activityEvents) {
    await activityEvents.close();
    activityEvents = null;
  }
  if (syncListEvents) {
    await syncListEvents.close();
    syncListEvents = null;
  }
}
