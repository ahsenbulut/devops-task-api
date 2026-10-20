import type pg from 'pg';
import { createPool } from '../../src/db.js';

const defaults = {
  PGHOST: '127.0.0.1',
  PGPORT: '5432',
  PGUSER: 'test',
  PGPASSWORD: 'test',
  PGDATABASE: 'tasks_test',
};

// Mirrors apps/task-api/migrations in the GitOps repository, which owns the real schema.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY,
  title varchar(200) NOT NULL,
  description varchar(1000),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

export async function createTestPool(): Promise<pg.Pool> {
  for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
  }
  const pool = createPool();
  await pool.query(SCHEMA);
  return pool;
}

export async function resetTasks(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE tasks');
}
