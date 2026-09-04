import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Starting setup re-checks who is at the keyboard. Accounts with a password
 * send it here; passwordless accounts send nothing and are asked for a session
 * younger than five minutes instead.
 */
export class SetupTwoFactorDto {
  @ApiProperty({
    description: 'Current password, required for accounts that have one',
    example: 'Password123!',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}
