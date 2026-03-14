import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { fetchActivityStreams } from '../lib/strava-api.js';
import type { Prisma } from '@prisma/client';

const router = Router();
router.use(authenticate);

// In-flight stream fetches — coalesces concurrent requests for the same activity
type StreamResult = { id: string; streamType: string; data: Prisma.JsonValue }[];
const fetchingStreams = new Map<string, Promise<StreamResult>>();

const filterSchema = z.object({
  q: z.string().max(100).optional(),
  sport: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// GET /api/activities?cursor=&limit=20&q=&sport=&startDate=&endDate=
router.get('/', async (req: Request, res: Response) => {
  const parsed = filterSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.flatten() });
    return;
  }

  const { q, sport, startDate, endDate, cursor, limit } = parsed.data;

  // Build where clause with type safety
  const where: Prisma.ActivityWhereInput = { userId: req.userId! };

  if (q) {
    // Escape ILIKE wildcards to prevent wildcard injection
    const escaped = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
    where.name = { contains: escaped, mode: 'insensitive' };
  }
  if (sport) {
    const sportTypes = sport.split(',').filter(Boolean).slice(0, 20);
    if (sportTypes.length > 0) {
      where.sportType = { in: sportTypes };
    }
  }
  if (startDate || endDate) {
    where.startDate = {};
    if (startDate) where.startDate.gte = new Date(startDate);
    if (endDate) where.startDate.lte = new Date(endDate);
  }

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { startDate: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      stravaActivityId: true,
      name: true,
      sportType: true,
      distance: true,
      movingTime: true,
      elapsedTime: true,
      totalElevationGain: true,
      startDate: true,
      startDateLocal: true,
      timezone: true,
      summaryPolyline: true,
      averageSpeed: true,
      averageHeartrate: true,
      maxHeartrate: true,
      hasHeartrate: true,
      calories: true,
      isPrivate: true,
      match: {
        select: {
          id: true,
          confidence: true,
          isManualOverride: true,
          plannedWorkout: {
            select: {
              id: true,
              workoutType: true,
              targetDistance: true,
              targetDuration: true,
            },
          },
        },
      },
    },
  });

  const hasMore = activities.length > limit;
  const items = hasMore ? activities.slice(0, limit) : activities;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const serialized = items.map((a) => ({
    ...a,
    stravaActivityId: a.stravaActivityId.toString(),
  }));

  res.json({ activities: serialized, nextCursor });
});

// GET /api/activities/:id/streams — Fetch streams on demand (placed BEFORE /:id)
router.get('/:id/streams', async (req: Request<{ id: string }>, res: Response) => {
  const activity = await prisma.activity.findUnique({
    where: { id: req.params.id },
    select: { id: true, userId: true, stravaActivityId: true, isManual: true, hasHeartrate: true },
  });

  if (!activity || activity.userId !== req.userId) {
    res.status(404).json({ error: 'Activity not found' });
    return;
  }

  // Check for already-stored streams
  const existingStreams = await prisma.activityStream.findMany({
    where: { activityId: activity.id },
    select: { id: true, streamType: true, data: true },
  });

  if (existingStreams.length > 0) {
    res.json({ streams: existingStreams });
    return;
  }

  // Skip Strava fetch for manual activities (unless they have HR data from wearable)
  if (activity.isManual && !activity.hasHeartrate) {
    res.json({ streams: [] });
    return;
  }

  // Coalesce concurrent fetches — second request reuses the first's Promise
  const inflight = fetchingStreams.get(activity.id);
  if (inflight) {
    const streams = await inflight;
    res.json({ streams });
    return;
  }

  const fetchPromise = (async () => {
    const stravaStreams = await fetchActivityStreams(
      req.userId!,
      activity.stravaActivityId,
      'user'
    );

    const streamTypes = ['time', 'distance', 'heartrate', 'altitude', 'velocity_smooth', 'latlng'];
    const upserts = streamTypes
      .filter((type) => stravaStreams[type])
      .map((type) =>
        prisma.activityStream.upsert({
          where: {
            activityId_streamType: {
              activityId: activity.id,
              streamType: type,
            },
          },
          update: { data: stravaStreams[type].data as Prisma.InputJsonValue },
          create: {
            activityId: activity.id,
            streamType: type,
            data: stravaStreams[type].data as Prisma.InputJsonValue,
          },
        })
      );

    await prisma.$transaction(upserts);

    return prisma.activityStream.findMany({
      where: { activityId: activity.id },
      select: { id: true, streamType: true, data: true },
    });
  })();

  fetchingStreams.set(activity.id, fetchPromise);
  try {
    const streams = await fetchPromise;
    res.json({ streams });
  } catch (err) {
    console.error('Failed to fetch streams from Strava:', err);
    res.status(502).json({ error: 'Failed to fetch stream data from Strava' });
  } finally {
    fetchingStreams.delete(activity.id);
  }
});

// GET /api/activities/:id — Activity detail (summary only, no Strava fetch)
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const activity = await prisma.activity.findUnique({
    where: { id: req.params.id },
    include: {
      match: {
        include: {
          plannedWorkout: true,
        },
      },
    },
  });

  if (!activity || activity.userId !== req.userId) {
    res.status(404).json({ error: 'Activity not found' });
    return;
  }

  res.json({
    activity: {
      ...activity,
      stravaActivityId: activity.stravaActivityId.toString(),
    },
  });
});

export default router;
