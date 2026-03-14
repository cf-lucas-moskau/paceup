import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { encrypt } from '../lib/encryption.js';
import { signToken, verifyToken } from '../lib/jwt.js';
import { exchangeCodeForTokens, getAuthorizationUrl } from '../lib/strava.js';
import { env } from '../lib/env.js';
import { syncListQueue } from '../queues/index.js';
import { sseManager } from '../services/sync-status.js';

const router = Router();

// GET /api/auth/strava — Redirect to Strava OAuth
router.get('/strava', (_req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  // In production, store state in a short-lived cookie or session to verify on callback
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000, // 10 minutes
    sameSite: 'lax',
  });
  res.redirect(getAuthorizationUrl(state));
});

// GET /api/auth/strava/callback — Handle Strava OAuth callback
router.get('/strava/callback', async (req: Request, res: Response) => {
  const { code, scope, error, state } = req.query;

  // Handle denial
  if (error === 'access_denied') {
    res.redirect(`${env.FRONTEND_URL}/?error=access_denied`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.redirect(`${env.FRONTEND_URL}/?error=missing_code`);
    return;
  }

  // Verify state parameter
  const savedState = req.cookies?.oauth_state;
  if (!savedState || savedState !== state) {
    res.redirect(`${env.FRONTEND_URL}/?error=invalid_state`);
    return;
  }
  res.clearCookie('oauth_state');

  // Check for partial consent — activity:read_all is required
  const grantedScopes = typeof scope === 'string' ? scope.split(',') : [];
  if (!grantedScopes.includes('activity:read_all')) {
    // User unchecked the activity scope checkbox — re-auth with force prompt
    const reAuthState = crypto.randomBytes(16).toString('hex');
    res.cookie('oauth_state', reAuthState, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
      sameSite: 'lax',
    });
    res.redirect(
      `${env.FRONTEND_URL}/auth/scope-required?reauth=${encodeURIComponent(getAuthorizationUrl(reAuthState, true))}`
    );
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Encrypt both tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Check if user already exists (to determine if initial sync needed)
    const existingUser = await prisma.user.findUnique({
      where: { stravaAthleteId: tokens.athlete.id },
      select: { id: true },
    });
    const isNewUser = !existingUser;

    // Upsert user — handles both new signups and re-authorizations
    const user = await prisma.user.upsert({
      where: { stravaAthleteId: tokens.athlete.id },
      update: {
        name: `${tokens.athlete.firstname} ${tokens.athlete.lastname}`,
        avatarUrl: tokens.athlete.profile_medium,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
        isConnected: true,
      },
      create: {
        stravaAthleteId: tokens.athlete.id,
        name: `${tokens.athlete.firstname} ${tokens.athlete.lastname}`,
        avatarUrl: tokens.athlete.profile_medium,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
      },
    });

    // Trigger initial sync for new users — import last 30 days of activities
    if (isNewUser) {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
      await syncListQueue.add(
        `sync-${user.id}`,
        {
          userId: user.id,
          afterTimestamp: thirtyDaysAgo,
        },
        { jobId: `sync-${user.id}-initial` }
      );
    }

    // Issue JWT session
    const jwt = signToken({
      userId: user.id,
      stravaAthleteId: user.stravaAthleteId,
    });

    res.cookie('token', jwt, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
      path: '/',
    });

    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error('Strava OAuth callback error:', err);
    res.redirect(`${env.FRONTEND_URL}/?error=auth_failed`);
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  // Close SSE connections before clearing the cookie
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = verifyToken(token);
      sseManager.disconnectUser(payload.userId);
    } catch {
      // Token invalid/expired — no SSE connections to clean up
    }
  }

  res.clearCookie('token', { path: '/' });
  res.json({ ok: true });
});

// GET /api/auth/me — Get current user
router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const { verifyToken } = await import('../lib/jwt.js');
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        timezone: true,
        unitPreference: true,
        isConnected: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
