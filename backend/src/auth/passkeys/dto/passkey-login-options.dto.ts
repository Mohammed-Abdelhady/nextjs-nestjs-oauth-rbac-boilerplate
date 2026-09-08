import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

/**
 * Body of POST /auth/passkeys/login/options. The address is accepted so a
 * client can keep one sign-in form, and ignored: the options come back the
 * same whether or not it has an account, and whether or not it was sent.
 */
export class PasskeyLoginOptionsDto {
  @ApiProperty({
    description: 'Ignored. Present so the client may post its sign-in form',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
