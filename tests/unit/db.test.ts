import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPool } from '../../src/db.js';
import { logger } from '../../src/logger.js';

describe('createPool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs idle client errors instead of crashing the process', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const pool = createPool();

    pool.emit('error', new Error('terminating connection due to administrator command'));

    expect(warn).toHaveBeenCalledWith('idle database client error', {
      error: 'terminating connection due to administrator command',
    });
    await pool.end();
  });
});
