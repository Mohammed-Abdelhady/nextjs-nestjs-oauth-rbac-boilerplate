import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({
    description: 'Role ID',
    example: '507f1f77bcf86cd799439011',
  })
  id!: string;

  @ApiProperty({
    description: 'Role name',
    example: 'Content Editor',
  })
  name!: string;

  @ApiProperty({
    description: 'Role slug',
    example: 'content-editor',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Can create and edit content',
  })
  description?: string;

  @ApiProperty({
    description: 'Is this a system role',
    example: false,
  })
  isSystemRole!: boolean;

  @ApiProperty({
    description: 'Is this role protected from deletion/modification',
    example: false,
  })
  isProtected!: boolean;

  @ApiProperty({
    description:
      'Hierarchy level. An actor can only manage roles below its own level.',
    example: 1,
  })
  level!: number;

  @ApiProperty({
    description: 'Default permissions for this role',
    example: ['posts:create', 'posts:update', 'posts:read:all'],
    type: [String],
  })
  permissions!: string[];

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-20T10:30:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-20T14:20:00Z',
  })
  updatedAt!: Date;
}

export class RoleUpdateResponseDto extends RoleResponseDto {
  @ApiProperty({
    description:
      'Users moved to the new slug by this rename. Zero when the slug is unchanged.',
    example: 0,
  })
  usersMoved!: number;
}

export class RoleListData {
  @ApiProperty({
    type: [RoleResponseDto],
    description: 'Array of roles',
  })
  roles!: RoleResponseDto[];

  @ApiProperty({
    description: 'Total number of roles',
    example: 15,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 2,
  })
  pages!: number;
}
