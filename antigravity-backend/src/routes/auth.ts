import { Router, Request, Response } from 'express';
import { createUser, getUserByEmail, getUserById, verifyPassword, updateLastLogin, getAllUsers, getPendingUsers, approveUser, rejectUser, findUserByApprovalToken, setResetToken, findByResetToken, updatePassword } from '../services/userService.js';
import { sendAdminNotification, sendApprovalEmail, sendRejectionEmail, sendPasswordResetEmail } from '../services/emailService.js';
import { config } from '../config/env.js';
import { generateToken } from '../services/jwtService.js';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    const user = await createUser(email, password, displayName);
    await sendAdminNotification({ email, displayName, createdAt: new Date() });
    res.status(201).json({ message: 'Registration successful. Please wait for admin approval.', userId: user.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({ error: message });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }
    const userWithPassword = await getUserByEmail(email);
    if (!userWithPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await verifyPassword(userWithPassword, password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    if (userWithPassword.status === 'rejected') {
      res.status(403).json({ error: 'Your account has been deactivated. Please contact admin to reactivate.' });
      return;
    }
    if (userWithPassword.status !== 'approved') {
      res.status(403).json({ error: 'Account not approved. Please wait for admin approval.' });
      return;
    }
    const userId = userWithPassword.id;
    await updateLastLogin(userId);
    const token = generateToken({ id: userId, email: userWithPassword.email, role: userWithPassword.role, status: userWithPassword.status, tokenVersion: userWithPassword.tokenVersion });
    res.json({ token, user: { id: userId, email: userWithPassword.email, role: userWithPassword.role, displayName: userWithPassword.displayName } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

router.get('/admin/users', authMiddleware, adminMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const users = await getAllUsers();
  res.json({ users });
});

router.get('/admin/pending', authMiddleware, adminMiddleware, async (_req: Request, res: Response): Promise<void> => {
  const users = await getPendingUsers();
  res.json({ users });
});

router.post('/admin/approve/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const user = await findUserByApprovalToken(token);
    if (!user) {
      res.status(404).json({ error: 'User not found or already processed' });
      return;
    }
    await approveUser(user.id);
    res.json({ message: 'User approved' });
  } catch (error) {
    res.status(500).json({ error: 'Approval failed' });
  }
});

router.post('/admin/reject/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const user = await findUserByApprovalToken(token);
    if (!user) {
      res.status(404).json({ error: 'User not found or already processed' });
      return;
    }
    await rejectUser(user.id);
    res.json({ message: 'User rejected' });
  } catch (error) {
    res.status(500).json({ error: 'Rejection failed' });
  }
});

router.post('/admin/users/:userId/approve', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.status !== 'pending' && user.status !== 'rejected') {
      res.status(400).json({ error: 'User cannot be approved' });
      return;
    }
    await approveUser(userId);
    await sendApprovalEmail(user);
    res.json({ message: 'User approved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Approval failed' });
  }
});

router.post('/admin/users/:userId/reject', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await rejectUser(userId);
    await sendRejectionEmail(user);
    res.json({ message: 'User rejected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Rejection failed' });
  }
});

router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }
    const user = await setResetToken(email);
    if (!user || !user.resetPasswordToken) {
      res.json({ message: 'If that email exists, a reset link has been sent.' });
      return;
    }
    await sendPasswordResetEmail(user, user.resetPasswordToken);
    if (config.server.nodeEnv === 'development' || !config.smtp.user) {
      const resetLink = `${config.server.frontendUrl}/reset-password/${user.resetPasswordToken}`;
      res.json({ message: 'Reset link sent. (Dev mode)', resetLink });
    } else {
      res.json({ message: 'If that email exists, a reset link has been sent.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    const user = await findByResetToken(token);
    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }
    await updatePassword(user.id, password);
    res.json({ message: 'Password reset successful. You can now login.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;