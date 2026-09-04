import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  NAME_MAX_LENGTH,
  NAME_MESSAGE,
  NAME_MIN_LENGTH,
  NAME_REGEX,
} from '../../common/constants/name';

/**
 * DTO for updating user basic information.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
    minLength: NAME_MIN_LENGTH,
    maxLength: NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MinLength(NAME_MIN_LENGTH, {
    message: `Name must be at least ${NAME_MIN_LENGTH} characters long`,
  })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `Name must not exceed ${NAME_MAX_LENGTH} characters`,
  })
  @Matches(NAME_REGEX, { message: NAME_MESSAGE })
  name?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;
}
