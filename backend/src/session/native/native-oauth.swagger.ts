import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

const AUTHORIZE_QUERY_DOCUMENTATION: Array<{
  name: string;
  description: string;
  required?: boolean;
  example?: string;
}> = [
  {
    name: 'response_type',
    description: 'Authorization response type',
    example: 'code',
  },
  { name: 'client_id', description: 'Registered native application id' },
  {
    name: 'redirect_uri',
    description: 'Registered application callback address',
  },
  { name: 'code_challenge', description: 'Base64url PKCE challenge' },
  {
    name: 'code_challenge_method',
    description: 'PKCE challenge method',
    example: 'S256',
  },
  {
    name: 'state',
    description: 'Opaque caller state returned to the callback',
  },
  {
    name: 'scope',
    description: 'Space-delimited requested scopes',
    required: false,
  },
];

export function ApiNativeAuthorizeStart(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Start native authorization',
      description:
        'Validates the client request and redirects to the localized browser confirmation page.',
    }),
    ...AUTHORIZE_QUERY_DOCUMENTATION.map(
      ({ name, description, required, example }) =>
        ApiQuery({
          name,
          description,
          required: required ?? true,
          ...(example ? { example } : {}),
        }),
    ),
    ApiResponse({
      status: 302,
      description: 'Redirects to the localized native authorization page',
      headers: {
        Location: {
          description: 'Localized browser confirmation URL',
          schema: { type: 'string' },
        },
      },
    }),
    ApiBadRequestResponse({
      description:
        'Invalid authorize request. The body is OAuth JSON, for example {"error":"invalid_request"}.',
    }),
  );
}

export function ApiNativeAuthorizeApproveErrors(): MethodDecorator {
  return applyDecorators(
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR when the transaction id is missing',
    }),
    ApiForbiddenResponse({
      description:
        'Browser proof is invalid, native sign-in is disabled, or GRANT_BLOCKED',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND or NATIVE_TRANSACTION_EXPIRED',
    }),
  );
}
