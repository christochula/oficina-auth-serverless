import { findCustomerByCpf } from '../../src/lib/customer-client';
import type { RuntimeConfig } from '../../src/types';

const config: RuntimeConfig = {
  osClientLookupUrl: 'https://gateway.test/api/v1/internal/auth/cliente',
  authClientLookupSecretArn: 'arn:lookup', clientLookupTimeoutMs: 5000,
  jwtSecretArn: 'arn:jwt', jwtTtlSeconds: 300, jwtIssuer: 'auth', jwtAudience: 'api',
  defaultRole: 'CLIENTE', defaultScopes: [], secretCacheTtlMs: 300000,
};
const token = 'lookup-token-with-at-least-32-bytes';
function fetcher(status: number, payload: unknown = {}) {
  return jest.fn().mockResolvedValue({ status, ok: status === 200, json: async () => payload }) as jest.MockedFunction<typeof fetch>;
}
describe('OS customer client', () => {
  it('sends only the normalized CPF through a bounded authenticated POST', async () => {
    const http = fetcher(200, { id: 'customer-id', nome: 'Client', email: 'test@example.test', ativo: true });
    const loadToken = jest.fn().mockResolvedValue(token);
    await expect(findCustomerByCpf('52998224725', config, http, loadToken)).resolves.toEqual({ id: 'customer-id', active: true });
    expect(loadToken).toHaveBeenCalledWith('arn:lookup', 300000);
    expect(http).toHaveBeenCalledWith(config.osClientLookupUrl, expect.objectContaining({
      method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-token': token },
      body: JSON.stringify({ cpf: '52998224725' }), redirect: 'error', signal: expect.any(AbortSignal),
    }));
  });
  it.each([401, 404])('maps status %i to a generic absent identity', async (status) => {
    await expect(findCustomerByCpf('cpf', config, fetcher(status), jest.fn().mockResolvedValue(token))).resolves.toBeNull();
  });
  it('unwraps the OS response envelope', async () => {
    await expect(findCustomerByCpf('cpf', config, fetcher(200, { data: { id: 'id', ativo: true } }), jest.fn().mockResolvedValue(token))).resolves.toEqual({ id: 'id', active: true });
  });
  it('uses the local development token without secret lookup', async () => {
    const local: RuntimeConfig = { ...config, authClientLookupToken: token };
    delete local.authClientLookupSecretArn;
    const loadToken = jest.fn();
    await expect(findCustomerByCpf('cpf', local, fetcher(200, { id: 'id', ativo: false }), loadToken)).resolves.toEqual({ id: 'id', active: false });
    expect(loadToken).not.toHaveBeenCalled();
  });
  it.each(['', 'short'])('rejects missing or weak token', async (authClientLookupToken) => {
    const local: RuntimeConfig = { ...config, authClientLookupToken };
    delete local.authClientLookupSecretArn;
    await expect(findCustomerByCpf('cpf', local, fetcher(200))).rejects.toThrow('lookup token');
  });
  it('rejects upstream failure without exposing response contents', async () => {
    await expect(findCustomerByCpf('cpf', config, fetcher(500), jest.fn().mockResolvedValue(token))).rejects.toThrow('unavailable');
  });
  it.each([null, [], 'invalid', {}, { data: 'invalid' }, { id: '', ativo: true }, { id: 'id', ativo: 'true' }])('rejects malformed identity %p', async (payload) => {
    await expect(findCustomerByCpf('cpf', config, fetcher(200, payload), jest.fn().mockResolvedValue(token))).rejects.toThrow('Invalid customer lookup response');
  });
  it('propagates timeout/network failures for generic handler error mapping', async () => {
    const http = jest.fn().mockRejectedValue(new Error('request timeout')) as jest.MockedFunction<typeof fetch>;
    await expect(findCustomerByCpf('cpf', config, http, jest.fn().mockResolvedValue(token))).rejects.toThrow('timeout');
  });
});
