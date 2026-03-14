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

  // Get all groups the user belongs to
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId: req.userId!,
      ...(groupIdFilter ? { groupId: groupIdFilter } : {}),
    },
    select: { groupId: true },
  });

  if (memberships.length === 0) {
    res.json({ activities: [], nextCursor: null });
    return;
  }

  const groupIds = memberships.map((m) => m.groupId);

  // Get all member IDs from those groups (excluding self)
  const groupMembers = await prisma.groupMembership.findMany({
    where: {
      groupId: { in: groupIds },
      userId: { not: req.userId! },
    },
    select: { userId: true },
  });

  const memberIds = [...new Set(groupMembers.map((m) => m.userId))];

  if (memberIds.length === 0) {
    res.json({ activities: [], nextCursor: null });
    return;
  }

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
