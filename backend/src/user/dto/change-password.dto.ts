import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_DESCRIPTION,
} from '../../common/constants/password';
import { PasswordPolicy } from '../../common/decorators/password-policy.decorator';

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
    description: PASSWORD_POLICY_DESCRIPTION,
    example: 'NewPassword123',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_BYTES,
  })
  @IsString()
  @PasswordPolicy()
  newPassword!: string;
}
