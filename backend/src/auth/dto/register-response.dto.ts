import { ApiResponse } from '../../common/dto/api-response.dto';
import { GENERIC_CODE_SENT_MESSAGE } from '../constants/auth-messages';

/**
 * Response DTO for registration.
 * The same body is returned for a new address and for one that is already
 * taken, so registration cannot be used to probe for accounts.
 */
export class RegisterResponseDto {
  email?: string;

  static success(email: string): ApiResponse<RegisterResponseDto> {
    const dto = new RegisterResponseDto();
    dto.email = email;
    return ApiResponse.success(dto, GENERIC_CODE_SENT_MESSAGE);
  }
}
