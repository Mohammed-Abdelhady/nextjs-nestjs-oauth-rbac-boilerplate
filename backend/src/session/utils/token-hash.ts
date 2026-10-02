import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashEquals(presented: string, storedHash: string): boolean {
  const left = Buffer.from(hashToken(presented), 'hex');
  const right = Buffer.from(storedHash, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function secretEquals(left: string, right: string): boolean {
  return hashEquals(left, hashToken(right));
}

export function randomSecret(): string {
  return randomBytes(32).toString('hex');
}
