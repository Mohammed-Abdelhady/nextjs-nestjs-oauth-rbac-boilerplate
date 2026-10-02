import { Request } from 'express';
import { resolveSessionCookieName } from '../../auth/services/session-cookie.service';

export function requestIp(request: Request): string {
  if (typeof request.ip === 'string' && request.ip.length > 0) {
    return request.ip;
  }
  return 'unknown';
}

export function requestUserAgent(request: Request): string {
  const header = request.headers['user-agent'];
  return typeof header === 'string' && header.trim().length > 0
    ? header
    : 'native';
}

export function readSessionCookie(
  request: Request,
  nodeEnv: string | undefined,
  configuredName: string | undefined,
): string | undefined {
  const cookies = request.cookies as Record<string, string> | undefined;
  const token = cookies?.[resolveSessionCookieName(nodeEnv, configuredName)];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}
