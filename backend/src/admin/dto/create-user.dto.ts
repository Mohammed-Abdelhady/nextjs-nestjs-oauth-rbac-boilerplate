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
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
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
