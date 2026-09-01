import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { createAuthHandler } from '../../src/handler';
import type { JwtMaterial, RuntimeConfig } from '../../src/types';

const config: RuntimeConfig = {
  dbSecretArn: 'arn:database',
  jwtSecretArn: 'arn:jwt',
  jwtTtlSeconds: 300,
  jwtIssuer: 'oficina-auth',
  jwtAudience: 'oficina-api',
  defaultRole: 'CLIENTE',
  defaultScopes: ['orders:read', 'orders:write'],
  secretCacheTtlMs: 300_000,
  pgPoolMax: 4,
  pgConnectionTimeoutMs: 3_000,
};
const material: JwtMaterial = {
  secret: 'a-secure-access-secret-with-at-least-32-bytes',
  refreshSecret: 'a-secure-refresh-secret-with-at-least-32-bytes',
};

function event(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /auth/token',
    rawPath: '/auth/token',
    rawQueryString: '',
    headers: { 'x-correlation-id': 'integration-test' },
    requestContext: {
      accountId: 'account',
      apiId: 'api',
      domainName: 'api.example.test',
      domainPrefix: 'api',
      http: {
        method: 'POST',
        path: '/auth/token',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest',
      },
      requestId: 'request-id',
      routeKey: 'POST /auth/token',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 0,
    },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

describe('POST /auth/token with mocked integrations', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('normalizes CPF, checks an active customer and returns a short JWT', async () => {
    const findCustomer = jest.fn().mockResolvedValue({
      id: 'customer-id',
      active: true,
    });
    const handler = createAuthHandler({
      config: () => config,
      findCustomer,
      jwtMaterial: jest.fn().mockResolvedValue(material),
      newJti: () => 'fixed-jti',
    });

    const result = await handler(event({ cpf: '529.982.247-25' }));
    expect(result.statusCode).toBe(200);
    expect(findCustomer).toHaveBeenCalledWith('52998224725', config);
    const body = JSON.parse(result.body ?? '{}') as { access_token: string };
    expect(jwt.verify(body.access_token, material.secret)).toMatchObject({
      sub: 'customer-id',
      client_id: 'customer-id',
      role: 'CLIENTE',
      token_use: 'client',
      jti: 'fixed-jti',
    });
  });

  it('returns the same generic response for invalid, absent and inactive clients', async () => {
    const cases = [
      { body: { cpf: '111.111.111-11' }, customer: { id: 'unused', active: true } },
      { body: { cpf: '529.982.247-25' }, customer: null },
      { body: { cpf: '529.982.247-25' }, customer: { id: 'id', active: false } },
    ];

    for (const scenario of cases) {
      const handler = createAuthHandler({
        config: () => config,
        findCustomer: jest.fn().mockResolvedValue(scenario.customer),
        jwtMaterial: jest.fn().mockResolvedValue(material),
        newJti: () => 'fixed-jti',
      });
      const result = await handler(event(scenario.body));
      expect(result.statusCode).toBe(401);
      expect(result.body).toBe(
        JSON.stringify({ message: 'Não foi possível autenticar.' }),
      );
    }
  });

  it('does not expose dependency errors', async () => {
    const handler = createAuthHandler({
      config: () => config,
      findCustomer: jest.fn().mockRejectedValue(new Error('password=do-not-leak')),
      jwtMaterial: jest.fn().mockResolvedValue(material),
      newJti: () => 'fixed-jti',
    });
    const result = await handler(event({ cpf: '529.982.247-25' }));
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('password');
  });
});
