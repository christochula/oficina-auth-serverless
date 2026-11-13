import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { getClientLookupToken, getJwtMaterial, getSecretJson, resetSecretCacheForTests } from '../../src/lib/secrets';

function mockClient(secret: unknown): SecretsManagerClient {
  return { send: jest.fn().mockResolvedValue({ SecretString: JSON.stringify(secret) }) } as unknown as SecretsManagerClient;
}
describe('Secrets Manager parsing and cache', () => {
  beforeEach(() => resetSecretCacheForTests());
  it('parses the shared access and refresh secret contract', async () => {
    const secret = { secret: 'a-secure-access-secret-with-at-least-32-bytes', refreshSecret: 'a-secure-refresh-secret-with-at-least-32-bytes' };
    await expect(getJwtMaterial('arn:jwt', 300_000, mockClient(secret))).resolves.toEqual(secret);
  });
  it.each([
    { secret: 'short', refreshSecret: 'also-short' },
    { secret: 'a-secure-access-secret-with-at-least-32-bytes', refreshSecret: 'short' },
  ])('rejects weak JWT material', async (secret) => {
    await expect(getJwtMaterial('arn:jwt', 1, mockClient(secret))).rejects.toThrow('at least 32 bytes');
  });
  it.each([null, [], 'string', {}, { token: '' }, { token: 'short' }])('rejects invalid lookup material %p', async (secret) => {
    await expect(getClientLookupToken('arn:lookup', 1, mockClient(secret))).rejects.toThrow();
  });
  it('loads the token for authenticated HTTP lookup', async () => {
    await expect(getClientLookupToken('arn:lookup', 1, mockClient({ token: 'secure-lookup-token-with-at-least-32-bytes' }))).resolves.toBe('secure-lookup-token-with-at-least-32-bytes');
  });
  it('caches a secret for the configured TTL', async () => {
    const secretsClient = mockClient({ value: 'cached' });
    await getSecretJson('arn:cache', 300_000, secretsClient);
    await getSecretJson('arn:cache', 300_000, secretsClient);
    expect(secretsClient.send).toHaveBeenCalledTimes(1);
  });
  it('supports binary secrets and rejects missing values', async () => {
    const binary = { send: jest.fn().mockResolvedValue({ SecretBinary: Buffer.from('{"value":"binary"}') }) } as unknown as SecretsManagerClient;
    await expect(getSecretJson('arn:binary', 1, binary)).resolves.toEqual({ value: 'binary' });
    const empty = { send: jest.fn().mockResolvedValue({}) } as unknown as SecretsManagerClient;
    await expect(getSecretJson('arn:empty', 1, empty)).rejects.toThrow('has no value');
  });
});
