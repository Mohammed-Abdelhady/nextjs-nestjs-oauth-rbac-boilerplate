import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { VerifyTwoFactorDto } from './verify-two-factor.dto';

/**
 * Turning the second factor off needs a code or a recovery code, plus the
 * password when the account has one.
 */
export class DisableTwoFactorDto extends VerifyTwoFactorDto {
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
