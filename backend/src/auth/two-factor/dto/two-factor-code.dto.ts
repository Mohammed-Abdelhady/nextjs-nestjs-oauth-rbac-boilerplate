import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** A six digit code from the authenticator app. */
export class TwoFactorCodeDto {
  @ApiProperty({
    description: 'Six digit code from the authenticator app',
    example: '123456',
  })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  code!: string;
}
