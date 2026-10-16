type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<Level | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function currentThreshold(): number {
  const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return configured in LEVEL_WEIGHT
    ? LEVEL_WEIGHT[configured as keyof typeof LEVEL_WEIGHT]
    : LEVEL_WEIGHT.info;
}

// Structured JSON logs, one line per event: info/debug go to stdout, warn/error to stderr.
// Container runtimes and Kubernetes collect both streams without any file handling in the app.
function write(level: Level, message: string, fields: Record<string, unknown> = {}): void {
  if (LEVEL_WEIGHT[level] < currentThreshold()) {
    return;
  }
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  if (level === 'warn' || level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => {
    write('debug', message, fields);
  },
  info: (message: string, fields?: Record<string, unknown>) => {
    write('info', message, fields);
  },
  warn: (message: string, fields?: Record<string, unknown>) => {
    write('warn', message, fields);
  },
  error: (message: string, fields?: Record<string, unknown>) => {
    write('error', message, fields);
  },
};
