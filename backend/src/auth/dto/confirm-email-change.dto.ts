import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Confirms the new address an admin moved an account to. It needs no password
 * and issues no session, so a deployment without password sign-in can still
 * confirm addresses.
 */
export class ConfirmEmailChangeDto {
  @ApiProperty({
    description: 'New email address the code was sent to',
    example: 'user@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase()?.trim())
  email!: string;

  @ApiProperty({
    description: '6-digit code sent to the new address',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Code must contain only digits' })
  code!: string;
}
