import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

const updateSettingsSchema = z.object({
  unitPreference: z.enum(['metric', 'imperial']).optional(),
  timezone: z.string().optional(),
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      timezone: true,
      unitPreference: true,
      isConnected: true,
    },
  });

  res.json({ user });
});

export default router;
