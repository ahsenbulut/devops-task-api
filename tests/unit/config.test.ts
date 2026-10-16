import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('uses defaults when variables are not set', () => {
    expect(loadConfig({})).toEqual({ port: 3000, shutdownTimeoutMs: 10_000 });
  });

  it('reads PORT and SHUTDOWN_TIMEOUT_MS from the environment', () => {
    expect(loadConfig({ PORT: '8080', SHUTDOWN_TIMEOUT_MS: '5000' })).toEqual({
      port: 8080,
      shutdownTimeoutMs: 5000,
    });
  });

  it('falls back to the default for an empty value', () => {
    expect(loadConfig({ PORT: ' ' }).port).toBe(3000);
  });

  it.each(['abc', '0', '-1', '3.5', '70000'])('rejects invalid PORT %s', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });
});
