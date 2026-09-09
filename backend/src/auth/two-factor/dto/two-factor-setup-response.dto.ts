import { ApiProperty } from '@nestjs/swagger';
import { ApiResponse } from '../../../common/dto/api-response.dto';

/**
 * What setup hands back. The QR code is left to the client: rendering it here
 * would mean carrying an image library for something a browser draws from the
 * URL on its own.
 */
export class TwoFactorSetupResponseDto {
  @ApiProperty({
    description: 'URL to render as a QR code for the authenticator app',
    example:
      'otpauth://totp/Auth%20Boilerplate:user%40example.com?secret=NYITGE7DZ7KUSQJFKLHJL2LZ6Z5IDTV7&issuer=Auth%20Boilerplate',
  })
  otpauthUrl!: string;

  @ApiProperty({
    description: 'The same secret in base32, for entering by hand',
    example: 'NYITGE7DZ7KUSQJFKLHJL2LZ6Z5IDTV7',
  })
  secret!: string;

  static success(
    otpauthUrl: string,
    secret: string,
  ): ApiResponse<TwoFactorSetupResponseDto> {
    const dto = new TwoFactorSetupResponseDto();
    dto.otpauthUrl = otpauthUrl;
    dto.secret = secret;
    return ApiResponse.success(dto, 'Scan the code, then confirm it');
  }
}
