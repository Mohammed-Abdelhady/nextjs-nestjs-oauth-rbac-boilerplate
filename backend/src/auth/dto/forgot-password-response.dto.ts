import { ApiProperty } from '@nestjs/swagger';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { GENERIC_CODE_SENT_MESSAGE } from '../constants/auth-messages';

/**
 * Response DTO for forgot password.
 * Identical whether or not the address belongs to an account.
 */
export class ForgotPasswordResponseDto {
  @ApiProperty({
    description: 'Email address the request was made for',
    example: 'user@example.com',
  })
  email!: string;

  static success(email: string): ApiResponse<ForgotPasswordResponseDto> {
    const dto = new ForgotPasswordResponseDto();
    dto.email = email;
    return ApiResponse.success(dto, GENERIC_CODE_SENT_MESSAGE);
  }
}
