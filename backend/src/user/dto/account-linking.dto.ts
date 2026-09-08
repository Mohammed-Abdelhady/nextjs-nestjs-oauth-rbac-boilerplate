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
}
