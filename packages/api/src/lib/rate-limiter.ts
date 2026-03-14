/**
 * Strava API rate limiter.
 * Limits: 300 read requests per 15 minutes, 3,000 read requests per day.
 * Tracks usage from X-RateLimit-Usage response headers.
 */

interface RateLimitState {
  shortTermUsage: number; // requests in current 15-min window
  shortTermLimit: number;
  dailyUsage: number;
  dailyLimit: number;
  lastUpdated: Date;
}

const state: RateLimitState = {
  shortTermUsage: 0,
  shortTermLimit: 300,
  dailyUsage: 0,
  dailyLimit: 3000,
  lastUpdated: new Date(),
};

type ThrottleLevel = 'none' | 'user_paused' | 'all_paused';

function getThrottleLevel(): ThrottleLevel {
  const shortPct = state.shortTermUsage / state.shortTermLimit;
  const dailyPct = state.dailyUsage / state.dailyLimit;

  if (dailyPct >= 0.95 || shortPct >= 0.95) return 'all_paused';
  if (dailyPct >= 0.80 || shortPct >= 0.80) return 'user_paused';
  return 'none';
}

export function canMakeRequest(priority: 'webhook' | 'user'): boolean {
  const level = getThrottleLevel();

  switch (level) {
    case 'none':
      return true;
    case 'user_paused':
      return priority === 'webhook';
    case 'all_paused':
      return false;
  }
}

/**
 * Update rate limit state from Strava response headers.
 * Headers: X-RateLimit-Limit: "200,2000" X-RateLimit-Usage: "42,150"
 */
export function updateFromHeaders(headers: Headers): void {
  const usage = headers.get('x-ratelimit-usage');
  const limit = headers.get('x-ratelimit-limit');

  if (usage) {
    const [short, daily] = usage.split(',').map(Number);
    state.shortTermUsage = short;
    state.dailyUsage = daily;
  }

  if (limit) {
    const [short, daily] = limit.split(',').map(Number);
    state.shortTermLimit = short;
    state.dailyLimit = daily;
  }

  state.lastUpdated = new Date();
}

