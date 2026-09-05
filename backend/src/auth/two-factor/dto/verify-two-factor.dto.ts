import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PasskeyCredentialDto } from '../../passkeys/dto/passkey-credential.dto';

/**
 * One of the three ways to answer a challenge. A code comes from the app, a
 * recovery code is one of the ten handed out at setup and works once, and a
 * passkey is signed by an authenticator the account already registered.
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
}
