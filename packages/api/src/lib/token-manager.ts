import { Mutex } from 'async-mutex';
import { prisma } from './prisma.js';
import { encrypt, decrypt } from './encryption.js';
import { refreshAccessToken } from './strava.js';

// Per-user mutex map to prevent concurrent token refreshes
const userMutexes = new Map<string, Mutex>();

function getMutex(userId: string): Mutex {
  let mutex = userMutexes.get(userId);
  if (!mutex) {
    mutex = new Mutex();
    userMutexes.set(userId, mutex);
  }
  return mutex;
}

const REFRESH_BUFFER_SECONDS = 60;

/**
 * Get a valid Strava access token for a user.
 * Refreshes proactively if within 60s of expiry.
 * Uses per-user mutex to prevent concurrent refresh race conditions.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const mutex = getMutex(userId);

  return mutex.runExclusive(async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
        isConnected: true,
      },
    });

    if (!user || !user.isConnected) {
      throw new Error('User not connected to Strava');
    }

    const now = new Date();
    const expiresAt = user.tokenExpiresAt;
    const needsRefresh = expiresAt.getTime() - now.getTime() < REFRESH_BUFFER_SECONDS * 1000;

    if (!needsRefresh) {
      return decrypt(user.accessToken);
    }

    // Decrypt refresh token, call Strava, re-encrypt both tokens
    const decryptedRefreshToken = decrypt(user.refreshToken);
    const tokens = await refreshAccessToken(decryptedRefreshToken);

    const encryptedNewAccessToken = encrypt(tokens.access_token);
    const encryptedNewRefreshToken = encrypt(tokens.refresh_token);

    await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: encryptedNewAccessToken,
        refreshToken: encryptedNewRefreshToken,
        tokenExpiresAt: new Date(tokens.expires_at * 1000),
      },
    });

    return tokens.access_token;
  });
}

/**
 * Clean up mutex for a user (call on deauthorization).
 */
export function clearUserMutex(userId: string): void {
  userMutexes.delete(userId);
}
