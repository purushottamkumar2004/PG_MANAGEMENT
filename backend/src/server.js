import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';

const server = app.listen(config.port, () => {
  console.log(`API listening on port ${config.port}`);
});

const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
