import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { fetchActivityStreams } from '../lib/strava-api.js';

const router = Router();
router.use(authenticate);

// GET /api/activities?cursor=&limit=20
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
  const cursor = req.query.cursor as string | undefined;

  const activities = await prisma.activity.findMany({
    where: { userId: req.userId! },
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

// GET /api/activities/:id — Full detail with streams
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const activity = await prisma.activity.findUnique({
    where: { id: req.params.id },
    include: {
      streams: true,
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

  // If no streams stored yet, fetch from Strava on-demand
  if (activity.streams.length === 0 && !activity.isManual) {
    try {
      const stravaStreams = await fetchActivityStreams(
        req.userId!,
        activity.stravaActivityId,
        'user'
      );

      const streamTypes = ['time', 'distance', 'heartrate', 'altitude', 'velocity_smooth', 'latlng'];
      for (const type of streamTypes) {
        if (stravaStreams[type]) {
          await prisma.activityStream.upsert({
            where: {
              activityId_streamType: {
                activityId: activity.id,
                streamType: type,
              },
            },
            update: { data: stravaStreams[type].data as any },
            create: {
              activityId: activity.id,
              streamType: type,
              data: stravaStreams[type].data as any,
            },
          });
        }
      }

      const updated = await prisma.activity.findUnique({
        where: { id: req.params.id },
        include: {
          streams: true,
          match: { include: { plannedWorkout: true } },
        },
      });

      res.json({
        activity: {
          ...updated,
          stravaActivityId: updated!.stravaActivityId.toString(),
        },
      });
      return;
    } catch (err) {
      console.error('Failed to fetch streams from Strava:', err);
    }
  }

  res.json({
    activity: {
      ...activity,
      stravaActivityId: activity.stravaActivityId.toString(),
    },
  });
});

export default router;
