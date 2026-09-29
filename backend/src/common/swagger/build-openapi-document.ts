import { DocumentBuilder } from '@nestjs/swagger';
import { SESSION_SWAGGER_AUTH_NAME } from '../constants/session';

export function buildOpenApiDocument(cookieName: string) {
  const trimmed = cookieName.trim();
  if (trimmed.length === 0) {
    throw new Error('OpenAPI session cookie name must be a non-empty string');
  }

  return new DocumentBuilder()
    .setTitle('FULL-MERN-AUTH-Boilerplate API')
    .setDescription(
      'Comprehensive authentication and user management API with OAuth support',
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints (register, login, logout)')
    .addTag('oauth', 'OAuth login through the configured providers')
    .addTag('user', 'User profile and session management')
    .addTag('admin', 'Admin user management endpoints')
    .addTag('health', 'Health check endpoint')
    .addCookieAuth(
      trimmed,
      {
        type: 'apiKey',
        in: 'cookie',
        name: trimmed,
        description:
          'Sign in with POST /api/auth/login from the same origin first. ' +
          'The browser sends the HttpOnly cookie automatically. ' +
          'The Authorize value cannot supply it.',
      },
      SESSION_SWAGGER_AUTH_NAME,
    )
    .build();
}
