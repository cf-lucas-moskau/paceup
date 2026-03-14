import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sseManager } from '../services/sync-status.js';
import { prisma } from '../lib/prisma.js';
import { syncListQueue } from '../queues/index.js';

const router = Router();
router.use(authenticate);

// GET /api/sync/events — SSE endpoint for real-time sync status
router.get('/events', (req: Request, res: Response) => {
  const userId = req.userId!;
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  // Check connection limit BEFORE writing headers
  if (!sseManager.canAddConnection(userId)) {
    res.status(429).json({ error: 'Too many connections' });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });
  res.flushHeaders();

  sseManager.addConnection(userId, res, token);

  // Send initial state
  res.write(`id: ${Date.now()}\nevent: init\ndata: ${JSON.stringify({ userId, status: 'connected' })}\n\n`);
});

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// POST /api/sync/trigger — Trigger a sync if data is stale
router.post('/trigger', async (req: Request, res: Response) => {
  const userId = req.userId!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastSyncAt: true, isConnected: true },
  });

  if (!user || !user.isConnected) {
    res.json({ status: 'disconnected' });
    return;
  }

  const now = Date.now();
  const lastSync = user.lastSyncAt ? user.lastSyncAt.getTime() : 0;

  if (now - lastSync < STALE_THRESHOLD_MS) {
    res.json({ status: 'fresh', lastSyncAt: user.lastSyncAt });
    return;
  }

  // Check if a sync is already in progress for this user
  const existingJobs = await syncListQueue.getJobs(['active', 'waiting', 'delayed']);
  const alreadySyncing = existingJobs.some((job) => job.data.userId === userId);

  if (alreadySyncing) {
    res.json({ status: 'syncing' });
    return;
  }

  // Enqueue a sync-list job
  const afterTimestamp = user.lastSyncAt
    ? Math.floor(user.lastSyncAt.getTime() / 1000)
    : undefined; // no lastSyncAt = fetch everything

  await syncListQueue.add(
    `sync-${userId}`,
    { userId, afterTimestamp },
    { jobId: `sync-${userId}-${Date.now()}` }
  );

  res.json({ status: 'syncing' });
});

export default router;
