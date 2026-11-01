import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findAccountByPhone } from '../lib/users.js';
import { signToken } from '../lib/jwt.js';
import { validationError, invalidCredentials, accountInactive } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

const loginSchema = z.object({
  phone: z.string().regex(/^[6-9][0-9]{9}$/, 'phone must be 10 digits starting 6-9'),
  password: z.string().min(1).max(100),
});

// Compared against when the phone is unknown, so both failures take similar time.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

export const authRouter = Router();

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw validationError(parsed.error.issues[0]?.message ?? 'Invalid input');
    const { phone, password } = parsed.data;

    const account = await findAccountByPhone(phone);
    const ok = await bcrypt.compare(password, account?.passwordHash ?? DUMMY_HASH);
    if (!account || !ok) throw invalidCredentials();
    // Checked only after the password, so a wrong password reveals nothing about the account.
    if (!account.active) throw accountInactive();

    res.json({ token: signToken(account.user), user: account.user });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.userProfile });
});

// Stateless: the app deletes its stored token.
authRouter.post('/logout', requireAuth, (_req, res) => {
  res.json({ ok: true });
});
