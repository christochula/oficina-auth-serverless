import { randomUUID } from 'node:crypto';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function correlationIdFrom(
  headers: Record<string, string | undefined> | undefined,
  fallback?: string,
): string {
  const candidate = Object.entries(headers ?? {}).find(
    ([name]) => name.toLowerCase() === 'x-correlation-id',
  )?.[1];

  if (candidate && SAFE_CORRELATION_ID.test(candidate)) {
    return candidate;
  }
  if (fallback && SAFE_CORRELATION_ID.test(fallback)) {
    return fallback;
  }
  return randomUUID();
}
