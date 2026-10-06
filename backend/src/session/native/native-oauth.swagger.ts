import { HttpStatus, applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import {
  NATIVE_DPOP_NONCE_HEADER,
  NATIVE_DPOP_PROOF_HEADER,
} from '../constants/session-policy';
import { OAUTH_ERROR } from './native-oauth.types';

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

export function ApiNativeTokenExchange(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Exchange a native authorization code or refresh token',
      description: `For authorization-code exchanges, a valid DPoP proof binds the token pair to its key. Invalid or reused proofs return ${OAUTH_ERROR.INVALID_DPOP_PROOF}. Missing or invalid nonces return ${OAUTH_ERROR.USE_DPOP_NONCE} with a fresh DPoP-Nonce header. Replaying a successfully exchanged code returns ${OAUTH_ERROR.INVALID_GRANT} because the code is consumed.`,
    }),
    ApiHeader({
      name: NATIVE_DPOP_PROOF_HEADER,
      required: false,
      description: 'ES256 proof for the authorization-code exchange',
    }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: `${OAUTH_ERROR.INVALID_DPOP_PROOF} identifies a refused proof. ${OAUTH_ERROR.USE_DPOP_NONCE} includes a fresh nonce response header. Unknown or consumed codes return ${OAUTH_ERROR.INVALID_GRANT}.`,
      headers: {
        [NATIVE_DPOP_NONCE_HEADER]: {
          description: 'Fresh server nonce for the next signed proof',
          schema: { type: 'string' },
        },
      },
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
