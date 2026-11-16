// Express app without listen(), so tests can drive it with Supertest.
import './config.js'; // throws if JWT_SECRET is missing
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { ownerRouter } from './routes/owner.js';
import { managerRouter } from './routes/manager.js';
import { notFoundRoute, errorHandler } from './middleware/errors.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/owner', ownerRouter);
app.use('/api/manager', managerRouter);

app.use(notFoundRoute);
app.use(errorHandler);
