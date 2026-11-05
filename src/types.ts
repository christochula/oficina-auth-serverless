export interface TokenConfig {
  jwtSecretArn: string;
  jwtIssuer: string;
  jwtAudience: string;
  secretCacheTtlMs: number;
}

export interface RuntimeConfig extends TokenConfig {
  osClientLookupUrl: string;
  authClientLookupSecretArn?: string;
  authClientLookupToken?: string;
  clientLookupTimeoutMs: number;
  jwtTtlSeconds: number;
  defaultRole: string;
  defaultScopes: string[];
}

export interface JwtMaterial {
  secret: string;
  refreshSecret: string;
}

export interface CustomerIdentity {
  id: string;
  active: boolean;
}

export interface VerifiedAccessToken {
  sub: string;
  role: string;
  scopes: string[];
  jti: string;
  tokenUse: 'client' | 'operator';
  clientId?: string;
}
