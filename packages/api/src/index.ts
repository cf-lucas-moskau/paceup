import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './lib/env.js';
import authRouter from './routes/auth.js';
import webhookRouter from './routes/webhooks.js';
import workoutsRouter from './routes/workouts.js';
import activitiesRouter from './routes/activities.js';
import settingsRouter from './routes/settings.js';
import groupsRouter from './routes/groups.js';
import groupTrainingRouter from './routes/group-training.js';
import feedRouter from './routes/feed.js';
import notificationsRouter from './routes/notifications.js';
import { processActivityWorker } from './queues/activity-worker.js';
import { processBackfillWorker } from './queues/backfill-worker.js';
import { runReconciliation } from './cron/reconciliation.js';

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/groups', groupTrainingRouter);
app.use('/api/feed', feedRouter);
app.use('/api/notifications', notificationsRouter);

// Start BullMQ workers
const activityWorker = processActivityWorker();
const backfillWorker = processBackfillWorker();
console.log('BullMQ workers started');

// Reconciliation cron — every 30 minutes
const THIRTY_MINUTES = 30 * 60 * 1000;
const reconciliationInterval = setInterval(() => {
  runReconciliation().catch((err) => console.error('Reconciliation error:', err));
}, THIRTY_MINUTES);

app.listen(env.PORT, () => {
  console.log(`PaceUp API running on port ${env.PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  clearInterval(reconciliationInterval);
  await activityWorker.close();
  await backfillWorker.close();
  process.exit(0);
});

export default app;
