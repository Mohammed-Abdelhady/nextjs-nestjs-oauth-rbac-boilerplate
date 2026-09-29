import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiCookieAuth, SwaggerModule } from '@nestjs/swagger';
import { SESSION_SWAGGER_AUTH_NAME } from '../constants/session';
import { buildOpenApiDocument } from './build-openapi-document';

@Controller('swagger-auth-test')
class SwaggerAuthTestController {
  @Get('protected')
  @ApiCookieAuth(SESSION_SWAGGER_AUTH_NAME)
  protectedRoute() {
    return true;
  }

  @Get('public')
  publicRoute() {
    return true;
  }
}

describe('buildOpenApiDocument', () => {
  it.each(['sid', '__Host-sid', 'custom-session-id'])(
    'registers only cookie session authentication named %s',
    (cookieName) => {
      const document = buildOpenApiDocument(cookieName);
      const schemes = document.components?.securitySchemes ?? {};

      expect(Object.keys(schemes)).toEqual([SESSION_SWAGGER_AUTH_NAME]);
      expect(schemes[SESSION_SWAGGER_AUTH_NAME]).toMatchObject({
        type: 'apiKey',
        in: 'cookie',
        name: cookieName,
      });
      expect(schemes['JWT-auth']).toBeUndefined();
    },
  );

  it('rejects an empty cookie name', () => {
    expect(() => buildOpenApiDocument('')).toThrow(
      'OpenAPI session cookie name must be a non-empty string',
    );
  });

  it('rejects a whitespace-only cookie name', () => {
    expect(() => buildOpenApiDocument('   ')).toThrow(
      'OpenAPI session cookie name must be a non-empty string',
    );
  });

  it('applies cookie security only to decorated operations', async () => {
    const module = await Test.createTestingModule({
      controllers: [SwaggerAuthTestController],
    }).compile();
    const app = module.createNestApplication();

    try {
      await app.init();
      const document = SwaggerModule.createDocument(
        app,
        buildOpenApiDocument('sid'),
      );

      expect(
        document.paths['/swagger-auth-test/protected']?.get?.security,
      ).toEqual([{ [SESSION_SWAGGER_AUTH_NAME]: [] }]);
      const publicOperation = document.paths['/swagger-auth-test/public']?.get;
      expect(publicOperation).toBeDefined();
      expect(publicOperation?.security).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});
