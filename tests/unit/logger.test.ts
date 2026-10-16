import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/logger.js';

describe('logger', () => {
  let stdout: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('writes info as a JSON line to stdout', () => {
    vi.stubEnv('LOG_LEVEL', 'info');

    logger.info('hello', { port: 3000 });

    expect(stderr).not.toHaveBeenCalled();
    const line = String(stdout.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toMatchObject({ level: 'info', message: 'hello', port: 3000 });
  });

  it('writes warn and error to stderr', () => {
    vi.stubEnv('LOG_LEVEL', 'info');

    logger.warn('careful');
    logger.error('failed');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledTimes(2);
  });

  it('filters messages below the configured level', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');

    logger.debug('hidden');
    logger.info('hidden');

    expect(stdout).not.toHaveBeenCalled();
  });

  it('falls back to info for an unknown level', () => {
    vi.stubEnv('LOG_LEVEL', 'verbose');

    logger.debug('hidden');
    logger.info('shown');

    expect(stdout).toHaveBeenCalledTimes(1);
  });
});
