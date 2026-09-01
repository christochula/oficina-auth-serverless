import { loadRuntimeConfig, loadTokenConfig } from '../../src/config';

describe('runtime configuration', () => {
  const base = {
    DB_SECRET_ARN: 'arn:database',
    JWT_SECRET_ARN: 'arn:jwt',
  };

  it('loads secure defaults', () => {
    expect(loadRuntimeConfig(base)).toEqual({
      dbSecretArn: 'arn:database',
      jwtSecretArn: 'arn:jwt',
      jwtTtlSeconds: 300,
      jwtIssuer: 'oficina-auth-serverless',
      jwtAudience: 'oficina-api',
      defaultRole: 'CLIENTE',
      defaultScopes: ['orders:read', 'orders:write'],
      secretCacheTtlMs: 300_000,
      pgPoolMax: 4,
      pgConnectionTimeoutMs: 3_000,
    });
  });

  it('allows the authorizer to load only token configuration', () => {
    expect(loadTokenConfig({ JWT_SECRET_ARN: 'arn:jwt' })).toMatchObject({
      jwtSecretArn: 'arn:jwt',
      jwtIssuer: 'oficina-auth-serverless',
      jwtAudience: 'oficina-api',
    });
  });

  it('rejects missing secret identifiers and invalid integers', () => {
    expect(() => loadRuntimeConfig({})).toThrow('JWT_SECRET_ARN');
    expect(() =>
      loadRuntimeConfig({ ...base, JWT_TTL_SECONDS: '0' }),
    ).toThrow('positive integer');
  });
});
