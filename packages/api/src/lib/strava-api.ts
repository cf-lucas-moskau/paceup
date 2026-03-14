import { getValidAccessToken } from './token-manager.js';
import { canMakeRequest, updateFromHeaders } from './rate-limiter.js';

const STRAVA_API_BASE = 'https://www.strava.com/api/v3';

class StravaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = 'StravaApiError';
  }
}

async function stravaFetch(
  userId: string,
  path: string,
  priority: 'webhook' | 'user' | 'backfill' = 'webhook'
): Promise<Response> {
  if (!canMakeRequest(priority)) {
    throw new StravaApiError('Rate limited — request paused', 429);
  }

  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(`${STRAVA_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  updateFromHeaders(response.headers);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('retry-after') ?? '900', 10);
    throw new StravaApiError('Strava rate limit exceeded', 429, retryAfter);
  }

  if (!response.ok) {
    throw new StravaApiError(
      `Strava API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return response;
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  start_date: string;
  start_date_local: string;
  timezone: string;
  map: { summary_polyline: string | null };
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate: boolean;
  suffer_score?: number;
  calories?: number;
  private: boolean;
  manual: boolean;
}

export async function fetchActivity(
  userId: string,
  activityId: number | bigint,
  priority: 'webhook' | 'user' | 'backfill' = 'webhook'
): Promise<StravaActivity> {
  const response = await stravaFetch(userId, `/activities/${activityId}`, priority);
  return response.json();
}

export async function fetchActivityStreams(
  userId: string,
  activityId: number | bigint,
  priority: 'webhook' | 'user' | 'backfill' = 'webhook'
): Promise<Record<string, { data: unknown[] }>> {
  const keys = 'time,distance,heartrate,altitude,velocity_smooth,latlng';
  const response = await stravaFetch(
    userId,
    `/activities/${activityId}/streams?keys=${keys}&key_by_type=true`,
    priority
  );
  return response.json();
}

export async function fetchAthleteActivities(
  userId: string,
  params: { after?: number; before?: number; page?: number; perPage?: number },
  priority: 'webhook' | 'user' | 'backfill' = 'backfill'
): Promise<StravaActivity[]> {
  const searchParams = new URLSearchParams();
  if (params.after) searchParams.set('after', String(params.after));
  if (params.before) searchParams.set('before', String(params.before));
  searchParams.set('page', String(params.page ?? 1));
  searchParams.set('per_page', String(params.perPage ?? 30));

  const response = await stravaFetch(
    userId,
    `/athlete/activities?${searchParams}`,
    priority
  );
  return response.json();
}

export { StravaApiError };
