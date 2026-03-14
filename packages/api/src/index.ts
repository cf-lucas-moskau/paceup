import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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
import { processSyncWorker } from './queues/sync-worker.js';
import { runReconciliation } from './cron/reconciliation.js';
import syncStatusRouter from './routes/sync-status.js';
import { sseManager } from './services/sync-status.js';
import { startSyncEvents, stopSyncEvents } from './services/sync-events.js';

// Global BigInt serialization — prevents "Do not know how to serialize a BigInt" errors
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SSE route — separate rate limiter (long-lived connections need different limits)
const sseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 connection attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/sync', sseLimiter, syncStatusRouter);

// Routes
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/webhooks', webhookLimiter, webhookRouter);
app.use('/api/workouts', apiLimiter, workoutsRouter);
app.use('/api/activities', apiLimiter, activitiesRouter);
app.use('/api/settings', apiLimiter, settingsRouter);
app.use('/api/groups', apiLimiter, groupsRouter);
app.use('/api/groups', apiLimiter, groupTrainingRouter);
app.use('/api/feed', apiLimiter, feedRouter);
app.use('/api/notifications', apiLimiter, notificationsRouter);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err.message, err.stack);
  res.status(500).json({ error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

// Start BullMQ workers
const activityWorker = processActivityWorker();
const syncWorker = processSyncWorker();
console.log('BullMQ workers started');

// Start SSE infrastructure
sseManager.start();
startSyncEvents();
console.log('SSE sync events started');

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
  await sseManager.shutdown();
  await stopSyncEvents();
  await activityWorker.close();
  await syncWorker.close();
  process.exit(0);
});

export default app;
