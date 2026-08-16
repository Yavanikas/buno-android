import { Router } from 'express';

const router = Router();

router.post('/register', (_req, res) => res.status(501).json({ error: 'Not implemented' }));
router.post('/login', (_req, res) => res.status(501).json({ error: 'Not implemented' }));

export default router;
