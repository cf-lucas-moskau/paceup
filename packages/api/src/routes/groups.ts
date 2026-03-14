import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { loadGroupMembership, requireRole } from '../middleware/group-auth.js';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

// Confusion-free alphabet (no 0/O/1/I/L)
const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function generateInviteCode(length = 6): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length])
    .join('');
}

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

// GET /api/groups — list user's groups
router.get('/', async (req: Request, res: Response) => {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: req.userId! },
    include: {
      group: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });

  const groups = memberships.map((m) => ({
    id: m.group.id,
    name: m.group.name,
    description: m.group.description,
    role: m.role,
    memberCount: m.group._count.memberships,
    joinedAt: m.joinedAt,
  }));

  res.json({ groups });
});

// POST /api/groups — create group
router.post('/', async (req: Request, res: Response) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        createdById: req.userId!,
      },
    });

    await tx.groupMembership.create({
      data: {
        userId: req.userId!,
        groupId: g.id,
        role: 'COACH',
      },
    });

    return g;
  });

  res.status(201).json({ group });
});

// GET /api/groups/:groupId — group details
router.get(
  '/:groupId',
  loadGroupMembership,
  async (req: Request<{ groupId: string }>, res: Response) => {
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        invites: req.membership!.role === 'COACH'
          ? {
              where: { expiresAt: { gt: new Date() } },
              orderBy: { createdAt: 'desc' },
              take: 5,
            }
          : false,
      },
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    res.json({
      group: {
        ...group,
        members: group.memberships.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
        memberships: undefined,
      },
      userRole: req.membership!.role,
    });
  }
);

// PUT /api/groups/:groupId — update group (coach only)
router.put(
  '/:groupId',
  loadGroupMembership,
  requireRole('COACH'),
  async (req: Request<{ groupId: string }>, res: Response) => {
    const parsed = updateGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const group = await prisma.group.update({
      where: { id: req.params.groupId },
      data: parsed.data,
    });

    res.json({ group });
  }
);

// POST /api/groups/:groupId/invites — generate invite code (coach only)
router.post(
  '/:groupId/invites',
  loadGroupMembership,
  requireRole('COACH'),
  async (req: Request<{ groupId: string }>, res: Response) => {
    const maxUses = req.body.maxUses || 10;
    const expiresInHours = req.body.expiresInHours || 72;

    const invite = await prisma.groupInvite.create({
      data: {
        groupId: req.params.groupId,
        code: generateInviteCode(),
        createdBy: req.userId!,
        maxUses,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ invite });
  }
);

// POST /api/groups/join/:code — redeem invite code
router.post('/join/:code', async (req: Request<{ code: string }>, res: Response) => {
  const code = req.params.code.toUpperCase();

  try {
    const membership = await prisma.$transaction(async (tx) => {
      const invite = await tx.groupInvite.findUnique({
        where: { code },
        include: { group: { select: { id: true, name: true } } },
      });

      if (!invite) {
        throw new Error('INVALID_CODE');
      }

      if (invite.expiresAt < new Date()) {
        throw new Error('EXPIRED');
      }

      if (invite.useCount >= invite.maxUses) {
        throw new Error('MAX_USES');
      }

      // Check existing membership
      const existing = await tx.groupMembership.findUnique({
        where: { userId_groupId: { userId: req.userId!, groupId: invite.groupId } },
      });

      if (existing) {
        throw new Error('ALREADY_MEMBER');
      }

      // Increment use count
      await tx.groupInvite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } },
      });

      // Create membership
      const m = await tx.groupMembership.create({
        data: {
          userId: req.userId!,
          groupId: invite.groupId,
          role: invite.role,
        },
      });

      // Notify group coaches
      const coaches = await tx.groupMembership.findMany({
        where: { groupId: invite.groupId, role: 'COACH' },
        select: { userId: true },
      });

      const joiner = await tx.user.findUnique({
        where: { id: req.userId! },
        select: { name: true },
      });

      if (coaches.length > 0) {
        await tx.notification.createMany({
          data: coaches.map((c) => ({
            userId: c.userId,
            type: 'member_joined',
            message: `${joiner?.name || 'Someone'} joined ${invite.group.name}`,
            data: { groupId: invite.groupId, memberId: req.userId! },
          })),
        });
      }

      return { ...m, groupName: invite.group.name };
    });

    res.status(201).json({ membership });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const statusMap: Record<string, number> = {
      INVALID_CODE: 404,
      EXPIRED: 410,
      MAX_USES: 410,
      ALREADY_MEMBER: 409,
    };
    res.status(statusMap[message] || 500).json({ error: message });
  }
});

// PUT /api/groups/:groupId/members/:memberId/role — change member role (coach only)
router.put(
  '/:groupId/members/:memberId/role',
  loadGroupMembership,
  requireRole('COACH'),
  async (
    req: Request<{ groupId: string; memberId: string }>,
    res: Response
  ) => {
    const { role } = req.body;
    if (!['COACH', 'ATHLETE'].includes(role)) {
      res.status(400).json({ error: 'Role must be COACH or ATHLETE' });
      return;
    }

    const targetMembership = await prisma.groupMembership.findUnique({
      where: {
        userId_groupId: { userId: req.params.memberId, groupId: req.params.groupId },
      },
    });

    if (!targetMembership) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const updated = await prisma.groupMembership.update({
      where: { id: targetMembership.id },
      data: { role },
    });

    res.json({ membership: updated });
  }
);

// DELETE /api/groups/:groupId/members/:memberId — remove member or leave group
router.delete(
  '/:groupId/members/:memberId',
  loadGroupMembership,
  async (
    req: Request<{ groupId: string; memberId: string }>,
    res: Response
  ) => {
    const isSelf = req.params.memberId === req.userId;
    const isCoach = req.membership!.role === 'COACH';

    // Athletes can only remove themselves
    if (!isSelf && !isCoach) {
      res.status(403).json({ error: 'Only coaches can remove members' });
      return;
    }

    // If a coach is leaving, transfer ownership to longest-tenured member
    if (isSelf && isCoach) {
      const otherCoaches = await prisma.groupMembership.count({
        where: {
          groupId: req.params.groupId,
          role: 'COACH',
          userId: { not: req.userId },
        },
      });

      if (otherCoaches === 0) {
        // Find longest-tenured non-coach member
        const nextOwner = await prisma.groupMembership.findFirst({
          where: {
            groupId: req.params.groupId,
            userId: { not: req.userId },
          },
          orderBy: { joinedAt: 'asc' },
        });

        if (nextOwner) {
          await prisma.groupMembership.update({
            where: { id: nextOwner.id },
            data: { role: 'COACH' },
          });
        }
        // If no other members, group will have no members — it's effectively dead
      }
    }

    await prisma.groupMembership.delete({
      where: {
        userId_groupId: { userId: req.params.memberId, groupId: req.params.groupId },
      },
    });

    res.json({ ok: true });
  }
);

export default router;
