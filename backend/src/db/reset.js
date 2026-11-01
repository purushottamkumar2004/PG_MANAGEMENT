// Drops everything in the database. Development and tests only.
import { fileURLToPath } from 'node:url';
import { pool } from './index.js';

export async function resetDatabase() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await resetDatabase();
  console.log('Database reset');
  await pool.end();
}
