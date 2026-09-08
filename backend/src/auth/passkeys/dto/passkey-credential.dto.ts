import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PASSKEY_MAX_FIELD_LENGTH } from '../constants/passkeys.constants';

/**
 * A credential as `navigator.credentials` hands it back, serialised by the
 * client. Only the envelope is checked here: the signature, the challenge and
 * the origin inside `response` are read by the WebAuthn library, which is the
 * only thing that can authenticate them.
 */
export class PasskeyCredentialDto {
  @ApiProperty({ description: 'Credential id, base64url' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSKEY_MAX_FIELD_LENGTH)
  id!: string;

  @ApiProperty({ description: 'Same id as sent by the browser, base64url' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSKEY_MAX_FIELD_LENGTH)
  rawId!: string;

  @ApiProperty({
    description:
      'Authenticator response: clientDataJSON with either attestationObject ' +
      'or authenticatorData, signature and userHandle',
    type: Object,
  })
  @IsObject()
  response!: Record<string, unknown>;

  @ApiProperty({
    description: 'platform or cross-platform, when the browser reports it',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(PASSKEY_MAX_FIELD_LENGTH)
  authenticatorAttachment?: string;

  @ApiProperty({
    description: 'Client extension outputs',
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  clientExtensionResults?: Record<string, unknown>;

  @ApiProperty({ description: 'Always public-key', example: 'public-key' })
  @IsIn(['public-key'])
  type!: string;
}
