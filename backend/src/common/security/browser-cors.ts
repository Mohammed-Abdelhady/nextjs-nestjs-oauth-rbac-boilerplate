import { CSRF_HEADER } from '../../session/constants/browser-proof';

export function browserCors(origin: string) {
  return {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
    exposedHeaders: [CSRF_HEADER],
  };
}
