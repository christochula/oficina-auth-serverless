import type { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import {
  getDatabaseSecret,
  getJwtMaterial,
  getSecretJson,
  resetSecretCacheForTests,
} from '../../src/lib/secrets';

function mockClient(secret: unknown): SecretsManagerClient {
  return {
    send: jest.fn().mockResolvedValue({ SecretString: JSON.stringify(secret) }),
  } as unknown as SecretsManagerClient;
}

describe('Secrets Manager parsing and cache', () => {
  beforeEach(() => resetSecretCacheForTests());

  it('parses the shared access and refresh secret contract', async () => {
    const secret = {
      secret: 'a-secure-access-secret-with-at-least-32-bytes',
      refreshSecret: 'a-secure-refresh-secret-with-at-least-32-bytes',
    };
    await expect(getJwtMaterial('arn:jwt', 300_000, mockClient(secret))).resolves.toEqual(
      secret,
    );
  });

  it('rejects weak or incomplete JWT material', async () => {
    await expect(
      getJwtMaterial(
        'arn:weak-jwt',
        300_000,
        mockClient({ secret: 'short', refreshSecret: 'also-short' }),
      ),
    ).rejects.toThrow('at least 32 bytes');
  });

  it('parses TLS database settings without exposing a connection string', async () => {
    await expect(
      getDatabaseSecret(
        'arn:db',
        300_000,
        mockClient({
          host: 'database.internal',
          port: 5432,
          dbname: 'oficina',
          username: 'runtime',
          password: 'managed-secret',
          sslmode: 'verify-full',
          ssl_ca: 'certificate',
        }),
      ),
    ).resolves.toMatchObject({
      host: 'database.internal',
      port: 5432,
      sslmode: 'verify-full',
      sslRejectUnauthorized: true,
    });
  });

  it('caches a secret for the configured TTL', async () => {
    const secretsClient = mockClient({ value: 'cached' });
    await getSecretJson('arn:cache', 300_000, secretsClient);
    await getSecretJson('arn:cache', 300_000, secretsClient);
    expect(secretsClient.send).toHaveBeenCalledTimes(1);
  });
});
