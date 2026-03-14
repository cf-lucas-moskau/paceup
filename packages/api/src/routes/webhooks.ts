import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { clearUserMutex } from '../lib/token-manager.js';
import { activityQueue } from '../queues/index.js';

const router = Router();

/**
 * GET /api/webhooks/strava — Strava subscription validation
 * Strava sends a GET request with hub.mode, hub.verify_token, hub.challenge
 * We must echo back hub.challenge to validate.
 */
router.get('/strava', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.STRAVA_VERIFY_TOKEN) {
    console.log('Strava webhook subscription validated');
    res.json({ 'hub.challenge': challenge });
  } else {
    res.status(403).json({ error: 'Verification failed' });
  }
});

const webhookEventSchema = z.object({
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number(),
  aspect_type: z.enum(['create', 'update', 'delete']),
  updates: z.record(z.unknown()).optional(),
  owner_id: z.number(),
  subscription_id: z.number(),
  event_time: z.number(),
});

type StravaWebhookEvent = z.infer<typeof webhookEventSchema>;

/**
 * POST /api/webhooks/strava — Receive Strava webhook events
 * Must respond 200 within 2 seconds. Processing happens async.
 */
router.post('/strava', async (req: Request, res: Response) => {
  // Validate payload schema
  const parsed = webhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    console.warn('Invalid webhook payload:', parsed.error.flatten());
    res.status(200).json({ received: true }); // Always 200 to prevent Strava retries
    return;
  }

  const event = parsed.data;

  // Verify subscription_id matches our known subscription
  if (env.STRAVA_SUBSCRIPTION_ID && event.subscription_id !== Number(env.STRAVA_SUBSCRIPTION_ID)) {
    console.warn(`Unknown subscription_id: ${event.subscription_id}`);
    res.status(200).json({ received: true });
    return;
  }

  // Respond immediately — Strava requires <2s response
  res.status(200).json({ received: true });

  // Process async
  try {
    await processWebhookEvent(event);
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

async function processWebhookEvent(event: StravaWebhookEvent): Promise<void> {
  // Idempotency check — composite key deduplication
  const eventKey = `${event.object_type}:${event.object_id}:${event.aspect_type}:${event.event_time}`;

  try {
    await prisma.stravaWebhookEvent.create({
      data: {
        eventKey,
        payload: JSON.parse(JSON.stringify(event)),
      },
    });
  } catch (err: unknown) {
    // Unique constraint violation = already processed
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      console.log(`Duplicate webhook event skipped: ${eventKey}`);
      return;
    }
    throw err;
  }

  // Find the user by Strava athlete ID
  const user = await prisma.user.findUnique({
    where: { stravaAthleteId: event.owner_id },
  });

  if (!user) {
    console.warn(`Webhook for unknown athlete: ${event.owner_id}`);
    return;
  }

  if (event.object_type === 'athlete') {
    await handleAthleteEvent(user.id, event);
  } else if (event.object_type === 'activity') {
    await handleActivityEvent(user.id, event);
  }
}

async function handleAthleteEvent(userId: string, event: StravaWebhookEvent): Promise<void> {
  // Deauthorization: athlete.update with authorized: "false"
  if (
    event.aspect_type === 'update' &&
    event.updates?.['authorized'] === 'false'
  ) {
    console.log(`User ${userId} deauthorized Strava — cleaning up`);

    // Mark user as disconnected and clear tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        isConnected: false,
        accessToken: '',
        refreshToken: '',
      },
    });

    // Delete all Strava data per API compliance
    await prisma.activity.deleteMany({ where: { userId } });

    clearUserMutex(userId);
  }
}

async function handleActivityEvent(userId: string, event: StravaWebhookEvent): Promise<void> {
  const stravaActivityId = BigInt(event.object_id);

  switch (event.aspect_type) {
    case 'create':
    case 'update':
      await activityQueue.add(
        `fetch-${event.object_id}-${event.aspect_type}`,
        {
          userId,
          stravaActivityId: event.object_id,
          action: event.aspect_type === 'create' ? 'fetch' : 'update',
          priority: 'webhook',
        },
        {
          jobId: `fetch-${event.object_id}-${event.aspect_type}`,
          priority: 1, // Highest priority for webhook-triggered syncs
        }
      );
      console.log(`Enqueued activity ${event.aspect_type}: ${event.object_id} for user ${userId}`);
      break;

    case 'delete':
      // Delete activity from local DB
      await prisma.activity.deleteMany({
        where: { stravaActivityId, userId },
      });
      console.log(`Activity deleted: ${event.object_id} for user ${userId}`);
      break;
  }
}

export default router;
