// Fresh schema once per test run.
export default async function setup() {
  const { resetDatabase } = await import('../src/db/reset.js');
  const { runMigrations } = await import('../src/db/migrate.js');
  const { pool } = await import('../src/db/index.js');
  await resetDatabase();
  await runMigrations();
  await pool.end();
}
