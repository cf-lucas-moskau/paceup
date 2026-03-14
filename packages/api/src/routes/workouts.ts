import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const createWorkoutSchema = z.object({
  weekStartDate: z.string().transform((s) => new Date(s)),
  dayOfWeek: z.number().int().min(0).max(6),
  workoutType: z.string(),
  targetDistance: z.number().positive().nullable().optional(),
  targetDuration: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

const updateWorkoutSchema = createWorkoutSchema.partial();

// GET /api/workouts?weekStart=2026-03-10&userId=optional
router.get('/', async (req: Request, res: Response) => {
  const weekStart = req.query.weekStart as string;
  const targetUserId = (req.query.userId as string) || req.userId!;

  if (!weekStart) {
    res.status(400).json({ error: 'weekStart query param required (ISO date)' });
    return;
  }

  const weekStartDate = new Date(weekStart);

  const workouts = await prisma.plannedWorkout.findMany({
    where: {
      userId: targetUserId,
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
            },
          },
        },
      },
      assignedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ dayOfWeek: 'asc' }],
  });

  res.json({ workouts });
});

// POST /api/workouts
router.post('/', async (req: Request, res: Response) => {
  const parsed = createWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { weekStartDate, dayOfWeek, workoutType, targetDistance, targetDuration, description } =
    parsed.data;

  try {
    const workout = await prisma.plannedWorkout.create({
      data: {
        userId: req.userId!,
        weekStartDate,
        dayOfWeek,
        workoutType,
        targetDistance: targetDistance ?? null,
        targetDuration: targetDuration ?? null,
        description: description ?? null,
      },
    });

    res.status(201).json({ workout });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      res.status(409).json({ error: 'A workout already exists for this day' });
      return;
    }
    throw err;
  }
});

// PUT /api/workouts/:id
router.put('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const parsed = updateWorkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.plannedWorkout.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: 'Workout not found' });
    return;
  }

  if (existing.userId !== req.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  const workout = await prisma.plannedWorkout.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  res.json({ workout });
});

// DELETE /api/workouts/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const existing = await prisma.plannedWorkout.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: 'Workout not found' });
    return;
  }

  if (existing.userId !== req.userId) {
    res.status(403).json({ error: 'Not authorized' });
    return;
  }

  await prisma.plannedWorkout.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// POST /api/workouts/:id/match — Manual match override
router.post('/:id/match', async (req: Request<{ id: string }>, res: Response) => {
  const { activityId } = req.body;

  if (!activityId) {
    res.status(400).json({ error: 'activityId required' });
    return;
  }

  const workout = await prisma.plannedWorkout.findUnique({
    where: { id: req.params.id },
  });

  if (!workout || workout.userId !== req.userId) {
    res.status(404).json({ error: 'Workout not found' });
    return;
  }

  await prisma.activityMatch.deleteMany({
    where: {
      OR: [{ plannedWorkoutId: req.params.id }, { activityId }],
    },
  });

  const match = await prisma.activityMatch.create({
    data: {
      activityId,
      plannedWorkoutId: req.params.id,
      confidence: 1.0,
      isManualOverride: true,
    },
  });

  res.json({ match });
});

// DELETE /api/workouts/:id/match — Remove match
router.delete('/:id/match', async (req: Request<{ id: string }>, res: Response) => {
  await prisma.activityMatch.deleteMany({
    where: { plannedWorkoutId: req.params.id },
  });
  res.json({ ok: true });
});

export default router;
