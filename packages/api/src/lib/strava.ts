import { z } from 'zod';
import { env } from './env.js';

const STRAVA_AUTH_BASE = 'https://www.strava.com/oauth';

export function getAuthorizationUrl(state: string, forcePrompt = false): string {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: forcePrompt ? 'force' : 'auto',
    scope: 'read,activity:read_all,profile:read_all',
    state,
  });
  return `${STRAVA_AUTH_BASE}/authorize?${params}`;
}

const stravaTokenResponseSchema = z.object({
  token_type: z.string(),
  expires_at: z.number(),
  expires_in: z.number(),
  refresh_token: z.string(),
  access_token: z.string(),
  athlete: z.object({
    id: z.number(),
    firstname: z.string(),
    lastname: z.string(),
    profile: z.string(),
    profile_medium: z.string(),
  }),
});

export type StravaTokenResponse = z.infer<typeof stravaTokenResponseSchema>;

export async function exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
  const response = await fetch(`${STRAVA_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Strava token exchange failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return stravaTokenResponseSchema.parse(data);
}

const stravaRefreshResponseSchema = z.object({
  token_type: z.string(),
  expires_at: z.number(),
  expires_in: z.number(),
  refresh_token: z.string(),
  access_token: z.string(),
});

export type StravaRefreshResponse = z.infer<typeof stravaRefreshResponseSchema>;

export async function refreshAccessToken(refreshToken: string): Promise<StravaRefreshResponse> {
  const response = await fetch(`${STRAVA_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Strava token refresh failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return stravaRefreshResponseSchema.parse(data);
}
