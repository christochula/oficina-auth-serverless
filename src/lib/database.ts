import { Pool, type PoolConfig } from 'pg';
import type { CustomerIdentity, RuntimeConfig } from '../types';
import { getDatabaseSecret } from './secrets';

let pool: Pool | undefined;
let poolSecretArn: string | undefined;
let poolExpiresAt = 0;

async function databasePool(config: RuntimeConfig): Promise<Pool> {
  if (
    pool &&
    poolSecretArn === config.dbSecretArn &&
    poolExpiresAt > Date.now()
  ) {
    return pool;
  }

  if (pool) {
    await pool.end();
    pool = undefined;
  }

  const secret = await getDatabaseSecret(
    config.dbSecretArn,
    config.secretCacheTtlMs,
  );
  const ssl: PoolConfig['ssl'] =
    secret.sslmode === 'disable'
      ? false
      : {
          rejectUnauthorized: secret.sslRejectUnauthorized,
          ...(secret.sslCa ? { ca: secret.sslCa } : {}),
        };

  pool = new Pool({
    host: secret.host,
    port: secret.port,
    database: secret.dbname,
    user: secret.username,
    password: secret.password,
    ssl,
    max: config.pgPoolMax,
    connectionTimeoutMillis: config.pgConnectionTimeoutMs,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    application_name: process.env.DD_SERVICE ?? 'oficina-auth',
  });
  poolSecretArn = config.dbSecretArn;
  poolExpiresAt = Date.now() + config.secretCacheTtlMs;
  return pool;
}

interface CustomerRow {
  id: string;
  ativo: boolean;
}

export async function findCustomerByCpf(
  cpf: string,
  config: RuntimeConfig,
): Promise<CustomerIdentity | null> {
  const database = await databasePool(config);
  const result = await database.query<CustomerRow>(
    `SELECT id::text AS id, ativo
       FROM clientes
      WHERE "tipoDoc" = $1
        AND "numeroDoc" = $2
      LIMIT 1`,
    ['CPF', cpf],
  );
  const customer = result.rows[0];
  return customer ? { id: customer.id, active: customer.ativo } : null;
}

export async function closeDatabasePoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
  }
  pool = undefined;
  poolSecretArn = undefined;
  poolExpiresAt = 0;
}
