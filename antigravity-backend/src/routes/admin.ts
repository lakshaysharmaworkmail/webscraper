import { Router, Request, Response } from 'express';
import { getAllUsers, getPendingUsers, approveUser, rejectUser } from '../services/userService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { getScrapeStats, getAllUsersStats, getScrapeHistoryByUser, getAllScrapeHistory, getUserStats } from '../services/scrapeHistoryService.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await getAllUsers();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/pending', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await getPendingUsers();
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

router.post('/approve/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    await approveUser(userId);
    res.json({ message: 'User approved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

router.post('/reject/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    await rejectUser(userId);
    res.json({ message: 'User rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject user' });
  }
});

router.get('/stats/overview', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getScrapeStats();
    const usersStats = await getAllUsersStats();
    res.json({ 
      ...stats,
      users: usersStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = parseInt(req.query.skip as string) || 0;
    
    let history;
    if (userId) {
      history = await getScrapeHistoryByUser(userId, limit);
    } else {
      history = await getAllScrapeHistory(limit, skip);
    }
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

router.get('/users/:userId/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const stats = await getUserStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

export default router;