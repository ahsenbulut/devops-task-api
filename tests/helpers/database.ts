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
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY,
  title varchar(200) NOT NULL,
  description varchar(1000),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
)`,
  `CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY,
  title varchar(200) NOT NULL,
  description varchar(2000),
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority varchar(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`,
];

export async function createTestPool(): Promise<pg.Pool> {
  for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
  }
  const pool = createPool();
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }
  return pool;
}

export async function resetTasks(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE tasks');
}

export async function resetTickets(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE tickets');
}
