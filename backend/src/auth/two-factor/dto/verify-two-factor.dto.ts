import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * One of the two ways to answer a challenge. A code comes from the app; a
 * recovery code is one of the ten handed out at setup and works once.
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
}
