import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/feed?cursor=&limit=&groupId=
router.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const cursor = req.query.cursor as string | undefined;
  const groupIdFilter = req.query.groupId as string | undefined;

  // Single query: get member IDs from user's groups (with optional filter)
  const memberships = await prisma.groupMembership.findMany({
    where: {
      group: {
        memberships: {
          some: {
            userId: req.userId!,
            ...(groupIdFilter ? { groupId: groupIdFilter } : {}),
          },
        },
      },
      userId: { not: req.userId! },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  if (memberships.length === 0) {
    res.json({ activities: [], nextCursor: null });
    return;
  }

  const memberIds = memberships.map((m) => m.userId);

  // Fetch activities from group members (non-private only)
  const activities = await prisma.activity.findMany({
    where: {
      userId: { in: memberIds },
      isPrivate: false,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true },
      },
      match: {
        select: { confidence: true },
      },
    },
    orderBy: { startDate: 'desc' },
    take: limit + 1,
  });

  const hasMore = activities.length > limit;
  const result = hasMore ? activities.slice(0, limit) : activities;
  const nextCursor = hasMore ? result[result.length - 1].id : null;

  // Serialize BigInt
  const serialized = result.map((a) => ({
    ...a,
    stravaActivityId: a.stravaActivityId.toString(),
  }));

  res.json({ activities: serialized, nextCursor });
});

export default router;
