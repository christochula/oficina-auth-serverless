import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { JwtMaterial, VerifiedAccessToken } from '../types';

interface SignTokenInput {
  subject: string;
  role: string;
  scopes: string[];
  jti: string;
  ttlSeconds: number;
  issuer: string;
  audience: string;
}

interface VerifiedJwtClaims extends JwtPayload {
  sub: string;
  jti: string;
  role: string;
  scopes: string[];
  token_use: 'client' | 'operator';
  client_id?: string;
}

export function signAccessToken(
  input: SignTokenInput,
  material: JwtMaterial,
): string {
  return jwt.sign(
    {
      role: input.role,
      scopes: input.scopes,
      token_use: 'client',
      client_id: input.subject,
    },
    material.secret,
    {
      algorithm: 'HS256',
      issuer: input.issuer,
      audience: input.audience,
      subject: input.subject,
      jwtid: input.jti,
      expiresIn: input.ttlSeconds,
    },
  );
}

function validClaims(payload: JwtPayload): payload is VerifiedJwtClaims {
  const commonClaimsAreValid =
    typeof payload.sub === 'string' &&
    payload.sub.length > 0 &&
    typeof payload.jti === 'string' &&
    typeof payload.iat === 'number' &&
    Number.isInteger(payload.iat) &&
    typeof payload.exp === 'number' &&
    Number.isInteger(payload.exp) &&
    payload.exp > payload.iat &&
    payload.jti.length > 0 &&
    typeof payload.role === 'string' &&
    payload.role.length > 0 &&
    Array.isArray(payload.scopes) &&
    payload.scopes.every((scope) => typeof scope === 'string');

  if (!commonClaimsAreValid) return false;
  if (payload.token_use === 'client') {
    return (
      typeof payload.client_id === 'string' && payload.client_id === payload.sub
    );
  }
  return payload.token_use === 'operator' && payload.role !== 'CLIENTE';
}

export function verifyAccessToken(
  token: string,
  material: JwtMaterial,
  issuer: string,
  audience: string,
): VerifiedAccessToken {
  const payload = jwt.verify(token, material.secret, {
    algorithms: ['HS256'],
    issuer,
    audience,
    clockTolerance: 5,
  });
  if (typeof payload === 'string' || !validClaims(payload)) {
    throw new Error('Invalid access token claims');
  }
  return {
    sub: payload.sub,
    role: payload.role,
    scopes: payload.scopes,
    jti: payload.jti,
    tokenUse: payload.token_use,
    ...(payload.token_use === 'client'
      ? { clientId: payload.client_id }
      : {}),
  };
}
