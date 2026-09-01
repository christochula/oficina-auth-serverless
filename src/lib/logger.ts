type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const candidate = process.env.LOG_LEVEL?.toLowerCase();
  return candidate === 'debug' ||
    candidate === 'info' ||
    candidate === 'warn' ||
    candidate === 'error'
    ? candidate
    : 'info';
}

export function errorMetadata(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { error_type: 'UnknownError' };
  }

  const code = (error as Error & { code?: unknown }).code;
  return {
    error_type: error.name,
    ...(typeof code === 'string' ? { error_code: code } : {}),
  };
}

export function log(
  level: LogLevel,
  event: string,
  correlationId: string,
  fields: Record<string, unknown> = {},
): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[configuredLevel()]) {
    return;
  }

  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    correlation_id: correlationId,
    service: process.env.DD_SERVICE ?? 'oficina-auth',
    environment: process.env.DD_ENV ?? 'local',
    ...fields,
  });

  if (level === 'error') {
    console.error(record);
  } else if (level === 'warn') {
    console.warn(record);
  } else {
    console.log(record);
  }
}
