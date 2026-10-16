export interface AppConfig {
  port: number;
  shutdownTimeoutMs: number;
}

const DEFAULT_PORT = 3000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: "${value}" must be a positive integer`);
  }
  return parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = parsePositiveInt(env.PORT, DEFAULT_PORT, 'PORT');
  if (port > 65_535) {
    throw new Error(`Invalid PORT: "${String(env.PORT)}" must be between 1 and 65535`);
  }
  return {
    port,
    shutdownTimeoutMs: parsePositiveInt(
      env.SHUTDOWN_TIMEOUT_MS,
      DEFAULT_SHUTDOWN_TIMEOUT_MS,
      'SHUTDOWN_TIMEOUT_MS',
    ),
  };
}
