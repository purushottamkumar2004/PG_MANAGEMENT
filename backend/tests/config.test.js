import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backendDir = fileURLToPath(new URL('..', import.meta.url));
const load = (env) => spawnSync(process.execPath, ['-e', "import('./src/app.js').then(() => process.exit(0))"], {
  cwd: backendDir, env: { ...process.env, ...env }, encoding: 'utf8',
});

describe('config', () => {
  // An empty value is not overridden by .env (dotenv never overwrites), so this simulates "not set".
  it('app refuses to start without JWT_SECRET', () => {
    const r = load({ JWT_SECRET: '' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('JWT_SECRET is not set');
  });

  it('app starts with JWT_SECRET set', () => {
    const r = load({ JWT_SECRET: 'some-secret' });
    expect(r.status).toBe(0);
  });
});
