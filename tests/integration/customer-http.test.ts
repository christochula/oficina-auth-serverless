import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { findCustomerByCpf } from '../../src/lib/customer-client';
import { loadRuntimeConfig } from '../../src/config';

describe('customer lookup over real local HTTP', () => {
  let server: Server;
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('honors the OS POST, secret header and response envelope contract', async () => {
    let received: { url?: string; method?: string; token?: string | string[]; correlation?: string | string[]; body?: unknown } = {};
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      received = {
        ...(request.url ? { url: request.url } : {}),
        ...(request.method ? { method: request.method } : {}),
        ...(request.headers['x-internal-token'] ? { token: request.headers['x-internal-token'] } : {}),
        ...(request.headers['x-correlation-id'] ? { correlation: request.headers['x-correlation-id'] } : {}),
        body: JSON.parse(body),
      };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { id: 'customer-id', nome: 'Demo', email: 'demo@example.test', ativo: true } }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing test address');
    const token = 'local-integration-token-with-more-than-32-bytes';
    const config = loadRuntimeConfig({
      JWT_SECRET_ARN: 'test-only', AUTH_CLIENT_LOOKUP_TOKEN: token,
      OS_CLIENT_LOOKUP_URL: `http://127.0.0.1:${address.port}/api/v1/internal/auth/cliente`,
    });
    await expect(findCustomerByCpf('52998224725', config, fetch, undefined, 'lookup-test')).resolves.toEqual({ id: 'customer-id', active: true });
    expect(received).toEqual({
      url: '/api/v1/internal/auth/cliente', method: 'POST', token, correlation: 'lookup-test', body: { cpf: '52998224725' },
    });
  });
});
