import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsRegisteredProvider } from '../../auth/oauth/validators/is-registered-provider.validator';

/**
 * DTO for choosing the provider that profile sync follows.
 */
export class SetPrimaryProviderDto {
  @ApiProperty({
    description: 'Registered OAuth provider id to set as primary',
    example: 'google',
  })
  @IsRegisteredProvider()
  @IsNotEmpty()
  provider!: string;
}

/** What an unlink of one listed sign-in method would be told now. */
export const UNLINK_HINT = {
  ALLOWED: 'allowed',
  /** Refused with CANNOT_UNLINK_LAST_PROVIDER: nothing else signs the account in. */
  LAST_SIGN_IN_METHOD: 'last_sign_in_method',
  /** Email sign-in is not a link, so it has no unlink. */
  NOT_REMOVABLE: 'not_removable',
} as const;

export type UnlinkHint = (typeof UNLINK_HINT)[keyof typeof UNLINK_HINT];

/** What choosing one listed sign-in method as primary would be told now. */
export const PRIMARY_HINT = {
  ALLOWED: 'allowed',
  /** Email sign-in has no provider profile, so it is never the primary. */
  NO_PROFILE_TO_SYNC: 'no_profile_to_sync',
} as const;

export type PrimaryHint = (typeof PRIMARY_HINT)[keyof typeof PRIMARY_HINT];

/**
 * Response DTO for linked providers.
 */
export class LinkedProvidersResponseDto {
  @ApiProperty({
    description: "Sign-in methods on the account: 'email' plus provider ids",
    example: ['email', 'google'],
    type: [String],
  })
  providers!: string[];

  @ApiProperty({
    description: 'Provider id used as the source for profile synchronization',
    example: 'google',
    required: false,
  })
  primaryProvider?: string;

  @ApiProperty({
    description:
      'For each entry of `providers`, what an unlink would be told now: ' +
      '`allowed`, `last_sign_in_method` (it would be refused with ' +
      'CANNOT_UNLINK_LAST_PROVIDER) or `not_removable` (email sign-in). ' +
      'Advice for a page: the unlink itself still decides.',
    example: { email: 'not_removable', google: 'allowed' },
    required: false,
    type: Object,
    additionalProperties: { type: 'string', enum: Object.values(UNLINK_HINT) },
  })
  unlinkHints?: Record<string, UnlinkHint>;

  @ApiProperty({
    description:
      'For each entry of `providers`, what choosing it as primary would be ' +
      'told now: `allowed` or `no_profile_to_sync` (email sign-in, refused ' +
      'with VALIDATION_ERROR). Advice for a page: the request still decides.',
    example: { email: 'no_profile_to_sync', google: 'allowed' },
    required: false,
    type: Object,
    additionalProperties: { type: 'string', enum: Object.values(PRIMARY_HINT) },
  })
  primaryHints?: Record<string, PrimaryHint>;
}
