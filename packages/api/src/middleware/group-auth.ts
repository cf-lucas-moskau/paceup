import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

declare global {
  namespace Express {
    interface Request {
      membership?: {
        id: string;
        role: string;
        groupId: string;
        userId: string;
      };
    }
  }
}

export async function loadGroupMembership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const groupId = req.params.groupId as string;
  if (!groupId || !req.userId) {
    res.status(400).json({ error: 'Group ID required' });
    return;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId: req.userId, groupId } },
  });

  if (!membership) {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }

  req.membership = {
    id: membership.id,
    role: membership.role,
    groupId: membership.groupId,
    userId: membership.userId,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.membership) {
      res.status(403).json({ error: 'Membership not loaded' });
      return;
    }

    if (!roles.includes(req.membership.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
