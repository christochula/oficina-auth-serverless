import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';
import { loadTokenConfig } from './config';
import type { JwtMaterial, TokenConfig } from './types';
import { correlationIdFrom } from './lib/correlation';
import { verifyAccessToken } from './lib/jwt';
import { errorMetadata, log } from './lib/logger';
import { getJwtMaterial } from './lib/secrets';

interface AuthorizerContext {
  sub: string;
  client_id: string;
  role: string;
  scopes: string;
  token_use: string;
  jti: string;
}

interface AuthorizerDependencies {
  config: () => TokenConfig;
  jwtMaterial: (secretArn: string, cacheTtlMs: number) => Promise<JwtMaterial>;
}

type AuthorizerResult = APIGatewaySimpleAuthorizerWithContextResult<AuthorizerContext>;
type AuthorizerHandler = (
  event: APIGatewayRequestAuthorizerEventV2,
) => Promise<AuthorizerResult>;

const defaultDependencies: AuthorizerDependencies = {
  config: loadTokenConfig,
  jwtMaterial: getJwtMaterial,
};

function bearerToken(event: APIGatewayRequestAuthorizerEventV2): string | null {
  const authorization =
    event.headers?.authorization ??
    event.headers?.Authorization ??
    event.identitySource?.[0];
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization ?? '');
  return match?.[1] ?? null;
}

// Endpoints publicos do NestJS (@Public / sem guard). O API Gateway usa uma
// unica rota ANY /api/{proxy+} com este authorizer; aqui liberamos os paths
// publicos sem exigir access token.
const PUBLIC_PATH_PREFIXES = [
  '/api/health',
  '/api/docs',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
];

function isPublicPath(path: string | undefined): boolean {
  if (!path) return false;
  return PUBLIC_PATH_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}-`),
  );
}

const ALLOW_PUBLIC: AuthorizerResult = {
  isAuthorized: true,
  context: {} as AuthorizerContext,
};

export function createAuthorizerHandler(
  dependencies: AuthorizerDependencies = defaultDependencies,
): AuthorizerHandler {
  return async (event) => {
    const correlationId = correlationIdFrom(
      event.headers,
      event.requestContext.requestId,
    );

    const path = event.requestContext.http.path;
    if (isPublicPath(path)) {
      log('info', 'authorizer.allowed', correlationId, {
        outcome: 'allowed',
        reason: 'public_path',
      });
      return ALLOW_PUBLIC;
    }

    const token = bearerToken(event);
    if (!token) {
      log('warn', 'authorizer.denied', correlationId, {
        outcome: 'denied',
        reason: 'missing_token',
      });
      return { isAuthorized: false, context: {} as AuthorizerContext };
    }

    try {
      const config = dependencies.config();
      const material = await dependencies.jwtMaterial(
        config.jwtSecretArn,
        config.secretCacheTtlMs,
      );
      const claims = verifyAccessToken(
        token,
        material,
        config.jwtIssuer,
        config.jwtAudience,
      );
      log('info', 'authorizer.allowed', correlationId, {
        outcome: 'allowed',
        token_use: claims.tokenUse,
      });
      return {
        isAuthorized: true,
        context: {
          sub: claims.sub,
          client_id: claims.clientId ?? '',
          role: claims.role,
          scopes: claims.scopes.join(' '),
          token_use: claims.tokenUse,
          jti: claims.jti,
        },
      };
    } catch (error) {
      log('warn', 'authorizer.denied', correlationId, {
        outcome: 'denied',
        reason: 'invalid_token',
        ...errorMetadata(error),
      });
      return { isAuthorized: false, context: {} as AuthorizerContext };
    }
  };
}

export const handler = createAuthorizerHandler();
