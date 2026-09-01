export interface TokenConfig {
  jwtSecretArn: string;
  jwtIssuer: string;
  jwtAudience: string;
  secretCacheTtlMs: number;
}

export interface RuntimeConfig extends TokenConfig {
  dbSecretArn: string;
  jwtTtlSeconds: number;
  defaultRole: string;
  defaultScopes: string[];
  pgPoolMax: number;
  pgConnectionTimeoutMs: number;
}

export interface DatabaseSecret {
  host: string;
  port: number;
  dbname: string;
  username: string;
  password: string;
  sslmode: 'require' | 'verify-full' | 'disable';
  sslCa?: string;
  sslRejectUnauthorized: boolean;
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
