import { randomUUID } from 'node:crypto';
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import { loadRuntimeConfig } from './config';
import type { CustomerIdentity, JwtMaterial, RuntimeConfig } from './types';
import { correlationIdFrom } from './lib/correlation';
import { isValidCpf, normalizeCpf } from './lib/cpf';
import { findCustomerByCpf } from './lib/database';
import { signAccessToken } from './lib/jwt';
import { errorMetadata, log } from './lib/logger';
import { emitAuthMetric } from './lib/metrics';
import { getJwtMaterial } from './lib/secrets';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

interface AuthDependencies {
  config: () => RuntimeConfig;
  findCustomer: (
    cpf: string,
    config: RuntimeConfig,
  ) => Promise<CustomerIdentity | null>;
  jwtMaterial: (secretArn: string, cacheTtlMs: number) => Promise<JwtMaterial>;
  newJti: () => string;
}

type AuthHandler = (
  event: APIGatewayProxyEventV2,
) => Promise<APIGatewayProxyStructuredResultV2>;

function response(
  statusCode: number,
  correlationId: string,
  body: Record<string, unknown>,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      ...JSON_HEADERS,
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(body),
  };
}

function parseCpf(event: APIGatewayProxyEventV2): string | null {
  if (!event.body) {
    return null;
  }
  const serialized = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  const body: unknown = JSON.parse(serialized);
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).cpf !== 'string'
  ) {
    return null;
  }
  return (body as { cpf: string }).cpf;
}

const defaultDependencies: AuthDependencies = {
  config: loadRuntimeConfig,
  findCustomer: findCustomerByCpf,
  jwtMaterial: getJwtMaterial,
  newJti: randomUUID,
};

export function createAuthHandler(
  dependencies: AuthDependencies = defaultDependencies,
): AuthHandler {
  return async (event) => {
    const correlationId = correlationIdFrom(
      event.headers,
      event.requestContext.requestId,
    );

    if (event.requestContext.http.method !== 'POST') {
      return response(405, correlationId, { message: 'Método não permitido.' });
    }

    let rawCpf: string | null;
    try {
      rawCpf = parseCpf(event);
    } catch {
      rawCpf = null;
    }

    if (!rawCpf || !isValidCpf(rawCpf)) {
      emitAuthMetric('failure', 'invalid_request');
      log('warn', 'auth.rejected', correlationId, {
        outcome: 'failure',
        reason: 'invalid_request',
      });
      return response(401, correlationId, {
        message: 'Não foi possível autenticar.',
      });
    }

    try {
      const config = dependencies.config();
      const customer = await dependencies.findCustomer(
        normalizeCpf(rawCpf),
        config,
      );
      if (!customer?.active) {
        emitAuthMetric('failure', 'invalid_credentials');
        log('warn', 'auth.rejected', correlationId, {
          outcome: 'failure',
          reason: 'invalid_credentials',
        });
        return response(401, correlationId, {
          message: 'Não foi possível autenticar.',
        });
      }

      const material = await dependencies.jwtMaterial(
        config.jwtSecretArn,
        config.secretCacheTtlMs,
      );
      const token = signAccessToken(
        {
          subject: customer.id,
          role: config.defaultRole,
          scopes: config.defaultScopes,
          jti: dependencies.newJti(),
          ttlSeconds: config.jwtTtlSeconds,
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        },
        material,
      );

      emitAuthMetric('success', 'authenticated');
      log('info', 'auth.succeeded', correlationId, {
        outcome: 'success',
        token_use: 'client',
      });
      return response(200, correlationId, {
        access_token: token,
        token_type: 'Bearer',
        expires_in: config.jwtTtlSeconds,
        scope: config.defaultScopes.join(' '),
      });
    } catch (error) {
      emitAuthMetric('failure', 'internal_error');
      log('error', 'auth.failed', correlationId, {
        outcome: 'failure',
        reason: 'internal_error',
        ...errorMetadata(error),
      });
      return response(500, correlationId, {
        message: 'Não foi possível processar a solicitação.',
      });
    }
  };
}

export const handler = createAuthHandler();
