import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PasskeyCredentialDto } from './passkey-credential.dto';
import { PASSKEY_NAME_MAX_LENGTH } from '../constants/passkeys.constants';

/** Body of POST /auth/passkeys/register/verify. */
export class VerifyPasskeyRegistrationDto {
  @ApiProperty({
    description: 'Credential returned by navigator.credentials.create()',
    type: PasskeyCredentialDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PasskeyCredentialDto)
  response!: PasskeyCredentialDto;

  @ApiProperty({
    description: 'Label for the passkey, shown in account settings',
    example: 'MacBook Touch ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(PASSKEY_NAME_MAX_LENGTH)
  name?: string;
}
