import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer'; // feature:passkeys
import {
  IsObject, // feature:passkeys
  IsOptional,
  IsString,
  Matches,
  ValidateNested, // feature:passkeys
} from 'class-validator';
import { PasskeyCredentialDto } from '../../passkeys/dto/passkey-credential.dto'; // feature:passkeys

/**
 * How a held sign-in is answered: a code from the authenticator app, one of
 * the ten recovery codes handed out at setup, which works once, or a
 * credential one of the registered second factor verifiers accepts.
 */
export class VerifyTwoFactorDto {
  @ApiProperty({
    description: 'Six digit code from the authenticator app',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code?: string;

  @ApiProperty({
    description: 'One of the recovery codes from setup',
    example: 'K3M7QRTVWX',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z2-7\s-]{10,24}$/, {
    message: 'recoveryCode must be ten base32 characters',
  })
  recoveryCode?: string;

  // feature:passkeys:start
  @ApiProperty({
    description:
      'Credential from navigator.credentials.get(), fetched with the options ' +
      'from POST /auth/passkeys/login/options while the challenge cookie is set',
    type: PasskeyCredentialDto,
    required: false,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PasskeyCredentialDto)
  passkeyResponse?: PasskeyCredentialDto;
  // feature:passkeys:end
}
