import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/token';
import { logAudit } from '../utils/audit';

const router = Router();

// ─── POST /register ─────────────────────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').optional().isString().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(400).json({ status: 'error', message: 'Email is already registered' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: name || null,
        },
      });

      const accessToken = generateAccessToken({ userId: user.id, email: user.email });
      const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

      // Persist refresh token (valid for 7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      await logAudit({
        userId: user.id,
        action: 'USER_REGISTER',
        entity: 'User',
        entityId: user.id,
        metadata: { email: user.email },
      });

      res.status(201).json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /login ────────────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(401).json({ status: 'error', message: 'Invalid email or password' });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ status: 'error', message: 'Invalid email or password' });
        return;
      }

      const accessToken = generateAccessToken({ userId: user.id, email: user.email });
      const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt,
        },
      });

      await logAudit({
        userId: user.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: user.id,
        metadata: { email: user.email },
      });

      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /refresh ──────────────────────────────────────────────────────────
router.post(
  '/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      let payload;
      try {
        payload = verifyToken(refreshToken);
      } catch {
        res.status(401).json({ status: 'error', message: 'Invalid or expired refresh token' });
        return;
      }

      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        if (storedToken) {
          await prisma.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => {});
        }
        res.status(401).json({ status: 'error', message: 'Refresh token expired or revoked' });
        return;
      }

      const newAccessToken = generateAccessToken({ userId: payload.userId, email: payload.email });
      const newRefreshToken = generateRefreshToken({ userId: payload.userId, email: payload.email });

      // Rotate refresh token
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: payload.userId,
          expiresAt,
        },
      });

      res.status(200).json({
        status: 'success',
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /logout ───────────────────────────────────────────────────────────
router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const authHeader = req.headers.authorization;

      let userId: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.slice(7).trim();
          const payload = verifyToken(token);
          userId = payload.userId;
        } catch {
          // Token may already be expired, continue with body refreshToken
        }
      }

      if (refreshToken) {
        try {
          const payload = verifyToken(refreshToken);
          userId = userId || payload.userId;
        } catch {
          // Ignore verify error on logout
        }
        await prisma.refreshToken.deleteMany({
          where: { token: refreshToken },
        }).catch(() => {});
      }

      if (userId) {
        await logAudit({
          userId,
          action: 'USER_LOGOUT',
          entity: 'User',
          entityId: userId,
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /me ────────────────────────────────────────────────────────────────
router.get(
  '/me',
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        res.status(404).json({ status: 'error', message: 'User not found' });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
