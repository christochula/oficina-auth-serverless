import type { CustomerIdentity, RuntimeConfig } from '../types';
import { getClientLookupToken } from './secrets';

export async function findCustomerByCpf(
  cpf: string,
  config: RuntimeConfig,
  fetcher: typeof fetch = fetch,
  loadToken: typeof getClientLookupToken = getClientLookupToken,
  correlationId?: string,
): Promise<CustomerIdentity | null> {
  const token = config.authClientLookupSecretArn
    ? await loadToken(config.authClientLookupSecretArn, config.secretCacheTtlMs)
    : config.authClientLookupToken;
  if (!token || Buffer.byteLength(token, 'utf8') < 32) {
    throw new Error('Invalid auth client lookup token');
  }
  const response = await fetcher(config.osClientLookupUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': token,
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    },
    body: JSON.stringify({ cpf }),
    signal: AbortSignal.timeout(config.clientLookupTimeoutMs),
    redirect: 'error',
  });
  if (response.status === 401 || response.status === 404) return null;
  if (!response.ok) throw new Error('Customer lookup unavailable');
  const payload: unknown = await response.json();
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Invalid customer lookup response');
  }
  const envelope = payload as Record<string, unknown>;
  const value = envelope.data ?? payload;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid customer lookup response');
  }
  const customer = value as Record<string, unknown>;
  if (typeof customer.id !== 'string' || !customer.id || typeof customer.ativo !== 'boolean') {
    throw new Error('Invalid customer lookup response');
  }
  return { id: customer.id, active: customer.ativo };
}
