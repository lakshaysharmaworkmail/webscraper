import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/jwtService.js';
import { getUserById } from '../services/userService.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    status: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload.status !== 'approved') {
      res.status(403).json({ error: 'Account not approved' });
      return;
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (user.status !== 'approved') {
      res.status(403).json({ error: 'Account has been deactivated. Please contact admin.' });
      return;
    }

    if ((user.tokenVersion || 0) !== (payload.tokenVersion || 0)) {
      res.status(401).json({ error: 'Session expired. Please login again.' });
      return;
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}