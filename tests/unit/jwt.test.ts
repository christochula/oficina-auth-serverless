import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../../src/lib/jwt';
import type { JwtMaterial } from '../../src/types';

const material: JwtMaterial = {
  secret: 'a-secure-access-secret-with-at-least-32-bytes',
  refreshSecret: 'a-secure-refresh-secret-with-at-least-32-bytes',
};

describe('JWT access token', () => {
  it('emits the client contract without CPF or operator identifiers', () => {
    const token = signAccessToken(
      {
        subject: 'customer-id-42',
        role: 'CLIENTE',
        scopes: ['orders:read'],
        jti: 'token-id',
        ttlSeconds: 300,
        issuer: 'oficina-auth',
        audience: 'oficina-api',
      },
      material,
    );

    const decoded = jwt.decode(token);
    expect(decoded).toMatchObject({
      sub: 'customer-id-42',
      client_id: 'customer-id-42',
      role: 'CLIENTE',
      token_use: 'client',
      scopes: ['orders:read'],
      jti: 'token-id',
      iss: 'oficina-auth',
      aud: 'oficina-api',
    });
    expect(decoded).not.toHaveProperty('cpf');
    expect(decoded).not.toHaveProperty('usuarioId');
  });

  it('verifies issuer, audience, algorithm and claims', () => {
    const token = signAccessToken(
      {
        subject: 'customer-id-42',
        role: 'CLIENTE',
        scopes: ['orders:read', 'orders:write'],
        jti: 'token-id',
        ttlSeconds: 300,
        issuer: 'oficina-auth',
        audience: 'oficina-api',
      },
      material,
    );

    expect(
      verifyAccessToken(token, material, 'oficina-auth', 'oficina-api'),
    ).toEqual({
      sub: 'customer-id-42',
      clientId: 'customer-id-42',
      role: 'CLIENTE',
      tokenUse: 'client',
      scopes: ['orders:read', 'orders:write'],
      jti: 'token-id',
    });
    expect(() =>
      verifyAccessToken(token, material, 'wrong-issuer', 'oficina-api'),
    ).toThrow();
  });

  it('accepts an operator access token issued by oficina-api', () => {
    const token = jwt.sign(
      {
        role: 'ADMINISTRADOR',
        papel: 'ADMINISTRADOR',
        token_use: 'operator',
        scopes: ['oficina:read', 'oficina:write'],
      },
      material.secret,
      {
        algorithm: 'HS256',
        issuer: 'oficina-auth-serverless',
        audience: 'oficina-api',
        subject: 'usuario-id',
        jwtid: 'operator-jti',
        expiresIn: 300,
      },
    );

    expect(
      verifyAccessToken(
        token,
        material,
        'oficina-auth-serverless',
        'oficina-api',
      ),
    ).toEqual({
      sub: 'usuario-id',
      role: 'ADMINISTRADOR',
      tokenUse: 'operator',
      scopes: ['oficina:read', 'oficina:write'],
      jti: 'operator-jti',
    });
  });

  it('rejects a signed token without expiration', () => {
    const token = jwt.sign(
      {
        role: 'ADMINISTRADOR',
        token_use: 'operator',
        scopes: ['oficina:read'],
      },
      material.secret,
      {
        algorithm: 'HS256',
        issuer: 'oficina-auth-serverless',
        audience: 'oficina-api',
        subject: 'usuario-id',
        jwtid: 'operator-jti',
      },
    );

    expect(() =>
      verifyAccessToken(
        token,
        material,
        'oficina-auth-serverless',
        'oficina-api',
      ),
    ).toThrow('Invalid access token claims');
  });
});
