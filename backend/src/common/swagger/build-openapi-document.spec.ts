import { SESSION_SWAGGER_AUTH_NAME } from '../constants/session';
import { buildOpenApiDocument } from './build-openapi-document';

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
});
