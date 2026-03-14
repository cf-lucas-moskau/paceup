import { prisma } from '../lib/prisma.js';
import { activityQueue } from '../queues/index.js';
import { fetchAthleteActivities } from '../lib/strava-api.js';

/**
 * Reconciliation cron: fetches recent activities for active users
 * and enqueues any that are missing from our DB.
 * Catches missed webhooks — Strava does NOT guarantee delivery.
 */
export async function runReconciliation(): Promise<void> {
  console.log('Starting activity reconciliation...');

  const activeUsers = await prisma.user.findMany({
    where: { isConnected: true },
    select: { id: true },
  });

  const twoHoursAgo = Math.floor(Date.now() / 1000) - 2 * 60 * 60;

  for (const user of activeUsers) {
    try {
      const activities = await fetchAthleteActivities(
        user.id,
        { after: twoHoursAgo, page: 1, perPage: 30 },
        'backfill'
      );

      for (const activity of activities) {
        const existing = await prisma.activity.findUnique({
          where: { stravaActivityId: BigInt(activity.id) },
          select: { id: true },
        });

        if (!existing) {
          await activityQueue.add(
            `reconcile-${activity.id}`,
            {
              userId: user.id,
              stravaActivityId: activity.id,
              action: 'fetch' as const,
              priority: 'user' as const,
            },
            {
              jobId: `reconcile-${activity.id}`,
              priority: 2,
            }
          );
        }
      }
    } catch (err) {
      console.error(`Reconciliation failed for user ${user.id}:`, err);
    }
  }

  console.log(`Reconciliation complete. Checked ${activeUsers.length} users.`);
}

/**
 * Subscription health check: verify Strava webhook subscription exists.
 * In production, this would call GET /push_subscriptions and alert if missing.
 */
export async function checkSubscriptionHealth(): Promise<void> {
  // This requires the Strava client_id and client_secret as query params
  // Placeholder — will be implemented when deploying to production
  console.log('Subscription health check: placeholder (implement for production)');
}
