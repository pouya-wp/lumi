import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** URL-safe random token with an optional readable prefix. */
export const token = (prefix = '', bytes = 24) => `${prefix}${randomBytes(bytes).toString('base64url')}`;

export const hmacSha256 = (secret: string, body: string | Buffer) => createHmac('sha256', secret).update(body).digest('hex');

/** Constant-time comparison of two strings (false when lengths differ). */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Public base URL of this API, used to build webhook, feed and bot URLs. */
export const publicApiUrl = () => (process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, '');
