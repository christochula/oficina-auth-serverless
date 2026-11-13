import { loadRuntimeConfig, loadTokenConfig } from '../../src/config';

describe('runtime configuration', () => {
  const base = {
    OS_CLIENT_LOOKUP_URL: 'https://gateway.test/api/v1/internal/auth/cliente',
    AUTH_CLIENT_LOOKUP_SECRET_ARN: 'arn:lookup',
    JWT_SECRET_ARN: 'arn:jwt',
  };

  it('loads secure defaults', () => {
    expect(loadRuntimeConfig(base)).toEqual({
      osClientLookupUrl: 'https://gateway.test/api/v1/internal/auth/cliente',
      authClientLookupSecretArn: 'arn:lookup',
      clientLookupTimeoutMs: 5000,
      jwtSecretArn: 'arn:jwt',
      jwtTtlSeconds: 300,
      jwtIssuer: 'oficina-auth-serverless',
      jwtAudience: 'oficina-api',
      defaultRole: 'CLIENTE',
      defaultScopes: ['orders:read', 'orders:write'],
      secretCacheTtlMs: 300_000,
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

  it('requires HTTPS and lookup material outside loopback', () => {
    expect(() => loadRuntimeConfig({ JWT_SECRET_ARN: 'arn:jwt' })).toThrow('OS_CLIENT_LOOKUP_URL');
    expect(() => loadRuntimeConfig({ ...base, OS_CLIENT_LOOKUP_URL: 'http://api.example.test' })).toThrow('HTTPS');
    expect(() => loadRuntimeConfig({ ...base, OS_CLIENT_LOOKUP_URL: 'https://user:pass@api.test' })).toThrow('HTTPS');
    expect(() => loadRuntimeConfig({ ...base, OS_CLIENT_LOOKUP_URL: 'https://api.test?q=cpf' })).toThrow('HTTPS');
    expect(() => loadRuntimeConfig({ ...base, OS_CLIENT_LOOKUP_URL: 'https://api.test#cpf' })).toThrow('HTTPS');
    expect(() => loadRuntimeConfig({ ...base, AUTH_CLIENT_LOOKUP_SECRET_ARN: '', AUTH_CLIENT_LOOKUP_TOKEN: 'ignored-in-cloud' })).toThrow('AUTH_CLIENT_LOOKUP_SECRET_ARN');
  });

  it('supports only loopback development tokens and custom limits/scopes', () => {
    expect(loadRuntimeConfig({ ...base, AUTH_CLIENT_LOOKUP_SECRET_ARN: '', AUTH_CLIENT_LOOKUP_TOKEN: 'local-token',
      OS_CLIENT_LOOKUP_URL: 'http://localhost:3000/api/v1/internal/auth/cliente', CLIENT_LOOKUP_TIMEOUT_MS: '1000',
      JWT_DEFAULT_ROLE: 'CLIENTE', JWT_DEFAULT_SCOPES: 'orders:read, billing:read', JWT_TTL_SECONDS: '',
    })).toMatchObject({ authClientLookupToken: 'local-token', clientLookupTimeoutMs: 1000, defaultScopes: ['orders:read', 'billing:read'] });
    expect(loadRuntimeConfig({ ...base, JWT_DEFAULT_SCOPES: ' , ' }).defaultScopes).toEqual(['orders:read', 'orders:write']);
  });
});
