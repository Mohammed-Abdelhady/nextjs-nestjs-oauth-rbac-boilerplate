import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  NAME_MAX_LENGTH,
  NAME_MESSAGE,
  NAME_MIN_LENGTH,
  NAME_REGEX,
} from '../../common/constants/name';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_DESCRIPTION,
} from '../../common/constants/password';
import { PasswordPolicy } from '../../common/decorators/password-policy.decorator';

/**
 * Activation carries the code, the password and the name in one request. No
 * credential exists before the address is proved, which is what stops the
 * first registrant choosing someone else's password.
 */
export class ActivateDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase()?.trim())
  email!: string;

  @ApiProperty({
    description: '6-digit activation code sent to email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Code must contain only digits' })
  code!: string;

  @ApiProperty({
    description: PASSWORD_POLICY_DESCRIPTION,
    example: 'Password123',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_BYTES,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @PasswordPolicy()
  password!: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(NAME_MIN_LENGTH, {
    message: `Name must be at least ${NAME_MIN_LENGTH} characters`,
  })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `Name must not exceed ${NAME_MAX_LENGTH} characters`,
  })
  @Matches(NAME_REGEX, { message: NAME_MESSAGE })
  @Transform(({ value }: { value: string }) => value?.trim())
  name!: string;
}
