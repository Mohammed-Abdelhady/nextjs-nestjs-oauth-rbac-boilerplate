import {
  IsOptional,
  IsInt,
  IsString,
  IsIn,
  IsBoolean,
  Matches,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ROLE_SLUG_MAX_LENGTH,
  ROLE_SLUG_MESSAGE,
  ROLE_SLUG_REGEX,
} from '../../common/constants/roles';

/**
 * Query parameters for listing users with pagination and filtering.
 */
export class ListUsersQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (default: 1)',
    example: 1,
    minimum: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search by email or name',
    example: 'john',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by role slug, custom roles included',
    example: 'support',
    type: String,
  })
  @IsOptional()
  @IsString()
  @MaxLength(ROLE_SLUG_MAX_LENGTH)
  @Matches(ROLE_SLUG_REGEX, { message: ROLE_SLUG_MESSAGE })
  role?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (active, inactive, deleted)',
    enum: ['active', 'inactive', 'deleted'],
    example: 'active',
    type: String,
  })
  @IsOptional()
  @IsIn(['active', 'inactive', 'deleted'])
  status?: 'active' | 'inactive' | 'deleted';

  @ApiPropertyOptional({
    description: 'Filter by verification status',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field (default: createdAt)',
    enum: ['createdAt', 'updatedAt', 'name', 'email'],
    example: 'createdAt',
    type: String,
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'name', 'email'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order (default: desc)',
    enum: ['asc', 'desc'],
    example: 'desc',
    type: String,
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
