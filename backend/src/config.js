// Runtime configuration. The app refuses to start without JWT_SECRET.
import 'dotenv/config';

const secret = process.env.JWT_SECRET?.trim();
if (!secret) throw new Error('JWT_SECRET is not set (see .env.example). Refusing to start.');

export const config = Object.freeze({
  jwtSecret: secret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN?.trim() || '30d',
  port: Number(process.env.PORT) || 4000,
});
