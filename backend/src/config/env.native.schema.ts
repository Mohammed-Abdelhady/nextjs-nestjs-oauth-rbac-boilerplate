import 'reflect-metadata';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { NATIVE_DPOP_SECRET_MIN_LENGTH } from '../session/constants/session-policy';
import { OAuthEnvironmentVariables } from './env.oauth.schema';
import {
  transformBoolean,
  transformOptionalString,
} from '../common/utils/environment-transform';

export class NativeEnvironmentVariables extends OAuthEnvironmentVariables {
  @Transform(transformBoolean(false))
  @IsBoolean()
  @IsOptional()
  AUTH_NATIVE_ENABLED: boolean = false;

  @Transform(transformBoolean(false))
  @IsBoolean()
  @IsOptional()
  AUTH_NATIVE_DPOP_REQUIRED: boolean = false;

  @ValidateIf((value: NativeEnvironmentVariables) => value.AUTH_NATIVE_ENABLED)
  @IsString()
  @MinLength(NATIVE_DPOP_SECRET_MIN_LENGTH)
  AUTH_NATIVE_DPOP_NONCE_SECRET?: string;

  @Transform(transformOptionalString)
  @IsString()
  @IsOptional()
  AUTH_NATIVE_APPLICATIONS?: string;

  @Transform(transformBoolean(false))
  @IsBoolean()
  @IsOptional()
  AUTH_NATIVE_ALLOW_CUSTOM_SCHEME: boolean = false;
}
