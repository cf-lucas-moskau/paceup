import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { loadGroupMembership } from '../middleware/group-auth.js';

const router = Router();
router.use(authenticate);

// GET /api/groups/:groupId/training?weekStart=2026-03-10
router.get(
  '/:groupId/training',
  loadGroupMembership,
  async (req: Request<{ groupId: string }>, res: Response) => {
    const weekStart = req.query.weekStart as string;
    if (!weekStart) {
      res.status(400).json({ error: 'weekStart query param required' });
      return;
    }

    const weekStartDate = new Date(weekStart);
    const isCoach = req.membership!.role === 'COACH';

    // Get all group members
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: req.params.groupId },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    const memberIds = memberships.map((m) => m.userId);

    // Get all planned workouts for all members this week
    const workouts = await prisma.plannedWorkout.findMany({
      where: {
        userId: { in: memberIds },
        weekStartDate,
      },
      include: {
        match: {
          include: {
            activity: {
              select: {
                id: true,
                name: true,
                sportType: true,
                distance: true,
                movingTime: true,
                startDateLocal: true,
                isPrivate: true,
              },
            },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }],
    });

    // Build per-member training data
    const memberTraining = memberships.map((m) => {
      const isSelf = m.userId === req.userId;
      const memberWorkouts = workouts
        .filter((w) => w.userId === m.userId)
        .map((w) => {
          // Filter out private activities from group view
          const match =
            w.match && !w.match.activity.isPrivate
              ? w.match
              : w.match && w.match.activity.isPrivate && isSelf
                ? w.match // Show own private activities to self
                : null;

          // For athletes viewing peers: show summary only (not detailed metrics)
          if (!isCoach && !isSelf) {
            return {
              id: w.id,
              dayOfWeek: w.dayOfWeek,
              workoutType: w.workoutType,
              targetDistance: w.targetDistance,
              isCompleted: !!match,
              // Peers only see completion status, not detailed activity data
            };
          }

          return {
            id: w.id,
            dayOfWeek: w.dayOfWeek,
            workoutType: w.workoutType,
            targetDistance: w.targetDistance,
            targetDuration: w.targetDuration,
            description: w.description,
            match: match
              ? {
                  confidence: match.confidence,
                  activity: {
                    id: match.activity.id,
                    name: match.activity.name,
                    sportType: match.activity.sportType,
                    distance: match.activity.distance,
                    movingTime: match.activity.movingTime,
                  },
                }
              : null,
          };
        });

      const planned = memberWorkouts.filter(
        (w) => w.workoutType !== 'Rest Day'
      ).length;
      const completed = memberWorkouts.filter(
        (w) => 'isCompleted' in w ? w.isCompleted : !!w.match
      ).length;

      return {
        user: { id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl },
        role: m.role,
        workouts: memberWorkouts,
        stats: {
          planned,
          completed,
          compliancePct: planned > 0 ? Math.round((completed / planned) * 100) : 0,
        },
      };
    });

    res.json({ memberTraining, userRole: req.membership!.role });
  }
);

export default router;
