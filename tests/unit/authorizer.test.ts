import type { APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { createAuthorizerHandler } from '../../src/authorizer';
import { signAccessToken } from '../../src/lib/jwt';
import type { JwtMaterial, TokenConfig } from '../../src/types';

const material: JwtMaterial = {
  secret: 'a-secure-access-secret-with-at-least-32-bytes',
  refreshSecret: 'a-secure-refresh-secret-with-at-least-32-bytes',
};
const config: TokenConfig = {
  jwtSecretArn: 'arn:jwt',
  jwtIssuer: 'oficina-auth',
  jwtAudience: 'oficina-api',
  secretCacheTtlMs: 300_000,
};

function event(authorization?: string): APIGatewayRequestAuthorizerEventV2 {
  return {
    version: '2.0',
    type: 'REQUEST',
    routeArn: 'arn:aws:execute-api:region:account:api/$default/GET/api/orders',
    identitySource: authorization ? [authorization] : [],
    routeKey: 'ANY /api/{proxy+}',
    rawPath: '/api/orders',
    rawQueryString: '',
    cookies: [],
    headers: authorization ? { authorization } : {},
    requestContext: {
      accountId: 'account',
      apiId: 'api',
      domainName: 'api.example.test',
      domainPrefix: 'api',
      http: {
        method: 'GET',
        path: '/api/orders',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'jest',
      },
      requestId: 'request-id',
      routeKey: 'ANY /api/{proxy+}',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 0,
    },
  };
}

describe('Lambda authorizer', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('allows a valid client token and exports minimal context', async () => {
    const token = signAccessToken(
      {
        subject: 'customer-id',
        role: 'CLIENTE',
        scopes: ['orders:read'],
        jti: 'jti',
        ttlSeconds: 300,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      },
      material,
    );
    const handler = createAuthorizerHandler({
      config: () => config,
      jwtMaterial: jest.fn().mockResolvedValue(material),
    });

    await expect(handler(event(`Bearer ${token}`))).resolves.toEqual({
      isAuthorized: true,
      context: {
        sub: 'customer-id',
        client_id: 'customer-id',
        role: 'CLIENTE',
        scopes: 'orders:read',
        token_use: 'client',
        jti: 'jti',
      },
    });
  });

  it.each([undefined, 'Bearer invalid-token'])('denies %s', async (header) => {
    const handler = createAuthorizerHandler({
      config: () => config,
      jwtMaterial: jest.fn().mockResolvedValue(material),
    });
    const result = await handler(event(header));
    expect(result.isAuthorized).toBe(false);
  });

  it('allows an operator access token after the public login flow', async () => {
    const token = jwt.sign(
      {
        role: 'MECANICO',
        token_use: 'operator',
        scopes: ['oficina:read', 'oficina:write'],
      },
      material.secret,
      {
        algorithm: 'HS256',
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
        subject: 'usuario-id',
        jwtid: 'operator-jti',
        expiresIn: 300,
      },
    );
    const handler = createAuthorizerHandler({
      config: () => config,
      jwtMaterial: jest.fn().mockResolvedValue(material),
    });

    await expect(handler(event(`Bearer ${token}`))).resolves.toMatchObject({
      isAuthorized: true,
      context: {
        sub: 'usuario-id',
        client_id: '',
        role: 'MECANICO',
        token_use: 'operator',
      },
    });
  });
});
