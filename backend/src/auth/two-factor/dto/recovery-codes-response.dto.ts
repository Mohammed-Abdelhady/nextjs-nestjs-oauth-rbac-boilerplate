import { ApiProperty } from '@nestjs/swagger';
import { ApiResponse } from '../../../common/dto/api-response.dto';

/** The one time the recovery codes are readable. Only hashes are kept. */
export class RecoveryCodesResponseDto {
  @ApiProperty({
    description: 'Recovery codes, shown once and never again',
    example: ['K3M7QRTVWX', 'A2B4C6D8EF'],
    type: [String],
  })
  recoveryCodes!: string[];

  static success(
    recoveryCodes: string[],
    message: string,
  ): ApiResponse<RecoveryCodesResponseDto> {
    const dto = new RecoveryCodesResponseDto();
    dto.recoveryCodes = recoveryCodes;
    return ApiResponse.success(dto, message);
  }
}
