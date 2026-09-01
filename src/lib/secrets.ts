import {
  GetSecretValueCommand,
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import type { DatabaseSecret, JwtMaterial } from '../types';

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
let defaultClient: SecretsManagerClient | undefined;

function client(): SecretsManagerClient {
  defaultClient ??= new SecretsManagerClient({} satisfies SecretsManagerClientConfig);
  return defaultClient;
}

function asObject(value: unknown, secretName: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Secret ${secretName} must contain a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  object: Record<string, unknown>,
  key: string,
  secretName: string,
): string {
  const value = object[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Secret ${secretName} is missing ${key}`);
  }
  return value;
}

export async function getSecretJson(
  secretArn: string,
  cacheTtlMs: number,
  secretsClient: SecretsManagerClient = client(),
): Promise<unknown> {
  const now = Date.now();
  const cached = cache.get(secretArn);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const response = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  const serialized =
    response.SecretString ??
    (response.SecretBinary
      ? Buffer.from(response.SecretBinary).toString('utf8')
      : undefined);
  if (!serialized) {
    throw new Error(`Secret ${secretArn} has no value`);
  }

  const value: unknown = JSON.parse(serialized);
  cache.set(secretArn, { value, expiresAt: now + cacheTtlMs });
  return value;
}

export async function getDatabaseSecret(
  secretArn: string,
  cacheTtlMs: number,
  secretsClient?: SecretsManagerClient,
): Promise<DatabaseSecret> {
  const value = asObject(
    await getSecretJson(secretArn, cacheTtlMs, secretsClient),
    'database',
  );
  const port = value.port;
  const sslMode = value.sslmode ?? 'verify-full';
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0) {
    throw new Error('Secret database has an invalid port');
  }
  if (
    sslMode !== 'require' &&
    sslMode !== 'verify-full' &&
    sslMode !== 'disable'
  ) {
    throw new Error('Secret database has an invalid sslmode');
  }

  return {
    host: requiredString(value, 'host', 'database'),
    port,
    dbname: requiredString(value, 'dbname', 'database'),
    username: requiredString(value, 'username', 'database'),
    password: requiredString(value, 'password', 'database'),
    sslmode: sslMode,
    ...(typeof value.ssl_ca === 'string' ? { sslCa: value.ssl_ca } : {}),
    sslRejectUnauthorized:
      typeof value.ssl_reject_unauthorized === 'boolean'
        ? value.ssl_reject_unauthorized
        : true,
  };
}

export async function getJwtMaterial(
  secretArn: string,
  cacheTtlMs: number,
  secretsClient?: SecretsManagerClient,
): Promise<JwtMaterial> {
  const value = asObject(
    await getSecretJson(secretArn, cacheTtlMs, secretsClient),
    'jwt',
  );
  const secret = requiredString(value, 'secret', 'jwt');
  const refreshSecret = requiredString(value, 'refreshSecret', 'jwt');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Secret jwt secret must have at least 32 bytes');
  }
  if (Buffer.byteLength(refreshSecret, 'utf8') < 32) {
    throw new Error('Secret jwt refreshSecret must have at least 32 bytes');
  }
  return {
    secret,
    refreshSecret,
  };
}

export function resetSecretCacheForTests(): void {
  cache.clear();
  defaultClient = undefined;
}
