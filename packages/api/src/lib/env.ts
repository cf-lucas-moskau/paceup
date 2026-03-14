import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`Warning: Missing environment variable: ${name}`);
    return '';
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export const env = {
  PORT: parseInt(optionalEnv('PORT', '3000'), 10),
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  REDIS_URL: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
  STRAVA_CLIENT_ID: requireEnv('STRAVA_CLIENT_ID'),
  STRAVA_CLIENT_SECRET: requireEnv('STRAVA_CLIENT_SECRET'),
  STRAVA_REDIRECT_URI: optionalEnv(
    'STRAVA_REDIRECT_URI',
    'http://localhost:3000/api/auth/strava/callback'
  ),
  STRAVA_VERIFY_TOKEN: requireEnv('STRAVA_VERIFY_TOKEN'),
  JWT_SECRET: requireEnv('JWT_SECRET'),
  TOKEN_ENCRYPTION_KEY: requireEnv('TOKEN_ENCRYPTION_KEY'),
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
} as const;
