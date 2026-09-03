import { AuthProvider } from '../../user/enums/auth-provider.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';

export interface OAuthLoginResponseData {
  id: string;
  email: string;
  name: string;
  role: string;
  authProvider: AuthProvider;
  isVerified: boolean;
  provider: string;
}

export class OAuthLoginResponseDto {
  static success(
    data: OAuthLoginResponseData,
  ): ApiResponse<OAuthLoginResponseData> {
    return ApiResponse.success(data);
  }
}
