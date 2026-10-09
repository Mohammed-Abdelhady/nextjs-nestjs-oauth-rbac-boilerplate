import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NativeAuthorizeActionDto {
  @ApiProperty({
    description: 'Identifier returned by the native authorize start route',
    example: '65bd2588-08ef-4489-9b07-543ca8124319',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  transactionId!: string;
}
