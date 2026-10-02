import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_MIN_LENGTH } from '../../common/constants/password';

/**
 * DTO for changing user password.
 * Requires current password verification.
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current user password for verification',
    example: 'OldPassword123',
  })
  @IsString()
  @MinLength(1, { message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({
    description: `New password (min ${PASSWORD_MIN_LENGTH} chars, must contain lowercase, uppercase, and number)`,
    example: 'NewPassword123',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: 128,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @MaxLength(128, { message: 'New password must not exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'New password must contain at least one lowercase letter, one uppercase letter, and one number',
  })
  newPassword!: string;
}
