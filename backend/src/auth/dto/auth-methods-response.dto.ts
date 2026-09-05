import { ApiProperty } from '@nestjs/swagger';
import { OAuthProviderSummary } from '../oauth/oauth-provider.interface';

export class AuthMethodsDto {
  @ApiProperty({
    description: 'Email and password sign-in is available',
    example: true,
  })
  password!: boolean;

  @ApiProperty({
    description: 'Sign-in links can be requested',
    example: true,
  })
  magicLink!: boolean;

  @ApiProperty({
    description: 'Accounts may add a TOTP second factor',
    example: true,
  })
  twoFactor!: boolean;

  @ApiProperty({
    description: 'Passkeys can be registered and used to sign in',
    example: true,
  })
  passkeys!: boolean;

  @ApiProperty({
    description: 'OAuth providers with credentials configured',
    example: [{ id: 'google', displayName: 'Google' }],
  })
  oauth!: OAuthProviderSummary[];
}

/** Payload of GET /auth/methods, read by the client to pick what to render. */
export class AuthMethodsResponseDto {
  @ApiProperty({ type: AuthMethodsDto })
  methods!: AuthMethodsDto;
}
