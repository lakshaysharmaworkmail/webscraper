import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getScrapeHistoryByUser } from '../services/scrapeHistoryService.js';

const router = Router();

router.get('/topics', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ topics: [] });
});

router.post('/topics', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  res.status(201).json({ topic: { id: '1', name: req.body.name } });
});

router.post('/topics/:id/subscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ message: 'Subscribed successfully' });
});

router.post('/topics/:id/unsubscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ message: 'Unsubscribed successfully' });
});

router.get('/search', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: 'Search query required' });
    return;
  }
  res.json({ results: [] });
});

router.get('/history', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await getScrapeHistoryByUser(req.user!.userId, limit);
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;