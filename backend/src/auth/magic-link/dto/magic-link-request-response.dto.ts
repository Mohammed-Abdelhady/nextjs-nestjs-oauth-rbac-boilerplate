import { ApiProperty } from '@nestjs/swagger';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { MAGIC_LINK_SENT_MESSAGE } from '../constants/magic-link.constants';

/**
 * Reply to a link request. Identical for an address with an account, an address
 * without one, and an address that has already hit the hourly cap.
 */
export class MagicLinkRequestResponseDto {
  @ApiProperty({
    description: 'Address the request was made for',
    example: 'user@example.com',
  })
  email!: string;

  static success(email: string): ApiResponse<MagicLinkRequestResponseDto> {
    const dto = new MagicLinkRequestResponseDto();
    dto.email = email;
    return ApiResponse.success(dto, MAGIC_LINK_SENT_MESSAGE);
  }
}
