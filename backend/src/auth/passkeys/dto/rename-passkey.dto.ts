import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSKEY_NAME_MAX_LENGTH } from '../constants/passkeys.constants';

/** Body of PATCH /auth/passkeys/:id. */
export class RenamePasskeyDto {
  @ApiProperty({
    description: 'New label for the passkey',
    example: 'iPhone',
    maxLength: PASSKEY_NAME_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSKEY_NAME_MAX_LENGTH)
  name!: string;
}
