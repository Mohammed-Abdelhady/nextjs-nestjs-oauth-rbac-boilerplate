import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RequestMagicLinkDto {
  @ApiProperty({
    description: 'Address the sign-in link is mailed to',
    example: 'user@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @IsNotEmpty({ message: 'Email is required' })
  @Transform(({ value }: { value: string }) => value?.toLowerCase()?.trim())
  email!: string;
}
