import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  ROLE_SLUG_MAX_LENGTH,
  ROLE_SLUG_MESSAGE,
  ROLE_SLUG_REGEX,
} from '../../common/constants/roles';
import {
  NAME_MAX_LENGTH,
  NAME_MESSAGE,
  NAME_MIN_LENGTH,
  NAME_REGEX,
} from '../../common/constants/name';

/**
 * DTO for creating a new user via admin panel.
 * Any existing role slug is accepted, including custom ones. The service
 * checks that the role exists and that the actor outranks it.
 */
export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  @IsString()
  @MinLength(NAME_MIN_LENGTH, {
    message: `Name must be at least ${NAME_MIN_LENGTH} characters long`,
  })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `Name must not exceed ${NAME_MAX_LENGTH} characters`,
  })
  @Matches(NAME_REGEX, { message: NAME_MESSAGE })
  name!: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecureP@ssw0rd',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password!: string;

  @ApiProperty({
    description:
      'Role slug to assign. Must exist and sit below the actor role level. ' +
      'ADMIN cannot be assigned through the API.',
    example: 'user',
  })
  @IsString()
  @MaxLength(ROLE_SLUG_MAX_LENGTH)
  @Matches(ROLE_SLUG_REGEX, { message: ROLE_SLUG_MESSAGE })
  role!: string;
}
