import { ApiResponse } from '../../common/dto/api-response.dto';
import { GENERIC_CODE_SENT_MESSAGE } from '../constants/auth-messages';

/**
 * Response DTO for resend activation.
 * Identical whether or not a pending registration exists for the address.
 */
export class ResendActivationResponseDto {
  email!: string;

  static success(email: string): ApiResponse<ResendActivationResponseDto> {
    const dto = new ResendActivationResponseDto();
    dto.email = email;
    return ApiResponse.success(dto, GENERIC_CODE_SENT_MESSAGE);
  }
}
