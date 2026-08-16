import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/token';

export interface AuthRequest extends Request {
  userId?: string;
  user?: TokenPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Missing or invalid token',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Empty token',
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        status: 'error',
        message: 'Token expired',
      });
      return;
    }
    res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token',
    });
  }
}
