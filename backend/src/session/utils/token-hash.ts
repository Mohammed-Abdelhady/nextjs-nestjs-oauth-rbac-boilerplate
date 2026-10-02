import * as crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function randomSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
