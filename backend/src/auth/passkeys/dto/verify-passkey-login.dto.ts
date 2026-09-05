import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { PasskeyCredentialDto } from './passkey-credential.dto';

/** Body of POST /auth/passkeys/login/verify. */
export class VerifyPasskeyLoginDto {
  @ApiProperty({
    description: 'Credential returned by navigator.credentials.get()',
    type: PasskeyCredentialDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PasskeyCredentialDto)
  response!: PasskeyCredentialDto;
}
