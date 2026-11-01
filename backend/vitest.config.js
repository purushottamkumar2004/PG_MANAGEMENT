import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Tests wipe the database, so they only run against TEST_DATABASE_URL.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is not set. Tests reset the database, so use a separate test database.');
process.env.DATABASE_URL = url;

export default defineConfig({
  test: {
    env: { DATABASE_URL: url, TZ: 'Asia/Kolkata' },
    globalSetup: './tests/global-setup.js',
    fileParallelism: false,
    testTimeout: 20000,
  },
});
