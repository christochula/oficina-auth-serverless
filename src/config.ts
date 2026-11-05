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
  const osClientLookupUrl = required(environment, 'OS_CLIENT_LOOKUP_URL');
  const lookupUrl = new URL(osClientLookupUrl);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(lookupUrl.hostname);
  if (lookupUrl.username || lookupUrl.password || lookupUrl.search || lookupUrl.hash ||
      (lookupUrl.protocol !== 'https:' && !(isLocal && lookupUrl.protocol === 'http:'))) {
    throw new Error('OS_CLIENT_LOOKUP_URL must use HTTPS (HTTP allowed only on loopback)');
  }
  const authClientLookupSecretArn = environment.AUTH_CLIENT_LOOKUP_SECRET_ARN?.trim();
  const authClientLookupToken = isLocal ? environment.AUTH_CLIENT_LOOKUP_TOKEN?.trim() : undefined;
  if (!authClientLookupSecretArn && !authClientLookupToken) {
    throw new Error('Missing required AUTH_CLIENT_LOOKUP_SECRET_ARN');
  }
  return {
    ...tokenConfig,
    osClientLookupUrl,
    ...(authClientLookupSecretArn ? { authClientLookupSecretArn } : {}),
    ...(authClientLookupToken ? { authClientLookupToken } : {}),
    clientLookupTimeoutMs: positiveInteger(environment, 'CLIENT_LOOKUP_TIMEOUT_MS', 5000),
    jwtTtlSeconds: positiveInteger(environment, 'JWT_TTL_SECONDS', 300),
    defaultRole: environment.JWT_DEFAULT_ROLE?.trim() || 'CLIENTE',
    defaultScopes: commaSeparated(environment.JWT_DEFAULT_SCOPES, [
      'orders:read',
      'orders:write',
    ]),
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
