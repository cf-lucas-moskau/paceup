import type { Response as ExpressResponse } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../lib/jwt.js';

export interface SyncEvent {
  type: 'sync-progress' | 'sync-complete' | 'sync-error' | 'init' | 'auth-expired' | 'server-shutdown';
  data: unknown;
}

interface Connection {
  res: ExpressResponse;
  userId: string;
  token: string;
  lastVerified: number;
}

const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL = 30_000;
const JWT_REVALIDATION_INTERVAL = 5 * 60 * 1000; // 5 minutes
const GROUP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class SSEConnectionManager {
  private connections = new Map<string, Set<Connection>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private groupCache = new Map<string, { userIds: string[]; expiresAt: number }>();

  start(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL);
  }

  canAddConnection(userId: string): boolean {
    const userConns = this.connections.get(userId);
    return !userConns || userConns.size < MAX_CONNECTIONS_PER_USER;
  }

  addConnection(userId: string, res: ExpressResponse, token: string): void {
    const conn: Connection = { res, userId, token, lastVerified: Date.now() };

    const userConns = this.connections.get(userId);
    if (!userConns) {
      this.connections.set(userId, new Set([conn]));
    } else {
      userConns.add(conn);
    }

    res.on('close', () => this.removeConnection(userId, conn));
  }

  disconnectUser(userId: string): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;
    for (const conn of userConns) {
      sendSSE(conn.res, 'auth-expired', { message: 'Session ended' });
      conn.res.end();
    }
    this.connections.delete(userId);
    this.groupCache.delete(userId);
  }

  removeConnection(userId: string, conn: Connection): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;
    userConns.delete(conn);
    if (userConns.size === 0) {
      this.connections.delete(userId);
    }
  }

  broadcastToUser(userId: string, event: string, data: unknown): void {
    const userConns = this.connections.get(userId);
    if (!userConns) return;
    for (const conn of userConns) {
      sendSSE(conn.res, event, data);
    }
  }

  async broadcastToGroupMembers(userId: string, event: string, data: unknown): Promise<void> {
    const memberIds = await this.getGroupMemberIds(userId);
    // Broadcast to the user themselves + all their group members who have active connections
    const targetIds = new Set([userId, ...memberIds]);
    for (const targetId of targetIds) {
      this.broadcastToUser(targetId, event, data);
    }
  }

  async getGroupMemberIds(userId: string): Promise<string[]> {
    const cached = this.groupCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.userIds;
    }

    // Find all group members for this user's groups
    const memberships = await prisma.groupMembership.findMany({
      where: { userId },
      select: { groupId: true },
    });

    if (memberships.length === 0) {
      this.groupCache.set(userId, { userIds: [], expiresAt: Date.now() + GROUP_CACHE_TTL });
      return [];
    }

    const groupIds = memberships.map((m) => m.groupId);
    const members = await prisma.groupMembership.findMany({
      where: { groupId: { in: groupIds }, userId: { not: userId } },
      select: { userId: true },
    });

    const userIds = [...new Set(members.map((m) => m.userId))];
    this.groupCache.set(userId, { userIds, expiresAt: Date.now() + GROUP_CACHE_TTL });
    return userIds;
  }

  clearGroupCacheForUser(userId: string): void {
    this.groupCache.delete(userId);
  }

  get connectionCount(): number {
    let count = 0;
    for (const conns of this.connections.values()) {
      count += conns.size;
    }
    return count;
  }

  private heartbeat(): void {
    const now = Date.now();
    for (const [userId, conns] of this.connections) {
      for (const conn of conns) {
        // JWT re-verification every 5 minutes
        if (now - conn.lastVerified > JWT_REVALIDATION_INTERVAL) {
          try {
            verifyToken(conn.token);
            conn.lastVerified = now;
          } catch {
            sendSSE(conn.res, 'auth-expired', { message: 'Token expired' });
            conn.res.end();
            this.removeConnection(userId, conn);
            continue;
          }
        }

        // Send keepalive
        conn.res.write(':keepalive\n\n');
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    for (const [userId, conns] of this.connections) {
      for (const conn of conns) {
        sendSSE(conn.res, 'server-shutdown', { message: 'Server shutting down' });
        conn.res.end();
      }
    }
    this.connections.clear();
    this.groupCache.clear();
  }
}

function sendSSE(res: ExpressResponse, event: string, data: unknown, id?: string): void {
  res.write(`id: ${id ?? Date.now()}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Singleton instance
export const sseManager = new SSEConnectionManager();
