import 'reflect-metadata';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  OAuthEnvironmentConfig,
  OAuthEnvironmentVariables,
} from './env.oauth.schema';

export interface EnvironmentConfig extends OAuthEnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  MONGO_URI: string;
  CLIENT_URL: string;
  API_URL?: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;

  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;

  BCRYPT_ROUNDS?: number;

  SESSION_COOKIE_NAME?: string;
  SESSION_COOKIE_MAX_AGE?: number;

  ACTIVATION_CODE_EXPIRES_IN?: number;
  ACTIVATION_MAX_ATTEMPTS?: number;

  AUTH_PASSWORD_ENABLED?: boolean;

  MAGIC_LINK_ENABLED?: boolean;
  MAGIC_LINK_EXPIRES_IN?: number;
  MAGIC_LINK_MAX_PER_HOUR?: number;

  SWAGGER_ENABLED?: boolean;
  PROFILE_SYNC_ENABLED?: boolean;
  PROFILE_SYNC_FIELDS?: string;
}

export function transformBoolean(
  defaultValue?: boolean,
): (params: { value: unknown }) => unknown {
  return ({ value }: { value: unknown }): unknown => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    if (value === 'true' || value === true) {
      return true;
    }
    if (value === 'false' || value === false) {
      return false;
    }
    return value;
  };
}

export class EnvironmentVariables extends OAuthEnvironmentVariables {
  @IsEnum(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  @Matches(/^mongodb(\+srv)?:\/\/.+$/, {
    message:
      'MONGO_URI must be a valid MongoDB connection string starting with mongodb:// or mongodb+srv://',
  })
  MONGO_URI!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  @IsOptional()
  CLIENT_URL: string = 'http://localhost:3000';

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  @IsOptional()
  API_URL?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  @IsOptional()
  THROTTLE_TTL: number = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  THROTTLE_LIMIT: number = 60;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  SMTP_PORT?: number;

  @Transform(transformBoolean())
  @IsBoolean()
  @IsOptional()
  SMTP_SECURE?: boolean;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(12)
  @IsOptional()
  BCRYPT_ROUNDS: number = 10;

  @IsString()
  @IsOptional()
  SESSION_COOKIE_NAME?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @IsOptional()
  SESSION_COOKIE_MAX_AGE: number = 604800000;

  @Type(() => Number)
  @IsInt()
  @Min(60000)
  @IsOptional()
  ACTIVATION_CODE_EXPIRES_IN: number = 900000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  ACTIVATION_MAX_ATTEMPTS: number = 5;

  @Transform(transformBoolean(true))
  @IsBoolean()
  @IsOptional()
  AUTH_PASSWORD_ENABLED: boolean = true;

  /**
   * Left unset, magic links follow SMTP: on when a host and a sender address
   * are configured, off otherwise. configuration.ts resolves that default.
   */
  @Transform(transformBoolean())
  @IsBoolean()
  @IsOptional()
  MAGIC_LINK_ENABLED?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(60000)
  @IsOptional()
  MAGIC_LINK_EXPIRES_IN: number = 900000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  MAGIC_LINK_MAX_PER_HOUR: number = 5;

  @Transform(transformBoolean(false))
  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED: boolean = false;

  @Transform(transformBoolean(true))
  @IsBoolean()
  @IsOptional()
  PROFILE_SYNC_ENABLED: boolean = true;

  @IsString()
  @IsOptional()
  PROFILE_SYNC_FIELDS: string = 'name,picture';
}
