import type { RuntimeConfig, TokenConfig } from './types';

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = environment[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }
  return parsed;
}

function commaSeparated(value: string | undefined, fallback: string[]): string[] {
  const parsed = value
    ?.split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed && parsed.length > 0 ? parsed : fallback;
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const tokenConfig = loadTokenConfig(environment);
  return {
    ...tokenConfig,
    dbSecretArn: required(environment, 'DB_SECRET_ARN'),
    jwtTtlSeconds: positiveInteger(environment, 'JWT_TTL_SECONDS', 300),
    defaultRole: environment.JWT_DEFAULT_ROLE?.trim() || 'CLIENTE',
    defaultScopes: commaSeparated(environment.JWT_DEFAULT_SCOPES, [
      'orders:read',
      'orders:write',
    ]),
    pgPoolMax: positiveInteger(environment, 'PG_POOL_MAX', 4),
    pgConnectionTimeoutMs: positiveInteger(
      environment,
      'PG_CONNECTION_TIMEOUT_MS',
      3_000,
    ),
  };
}

export function loadTokenConfig(
  environment: NodeJS.ProcessEnv = process.env,
): TokenConfig {
  return {
    jwtSecretArn: required(environment, 'JWT_SECRET_ARN'),
    jwtIssuer: environment.JWT_ISSUER?.trim() || 'oficina-auth-serverless',
    jwtAudience: environment.JWT_AUDIENCE?.trim() || 'oficina-api',
    secretCacheTtlMs: positiveInteger(
      environment,
      'SECRET_CACHE_TTL_MS',
      300_000,
    ),
  };
}
