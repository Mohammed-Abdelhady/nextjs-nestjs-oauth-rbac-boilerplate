import 'reflect-metadata';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';
import { OAUTH_STATE_SECRET_MIN_LENGTH } from '../auth/oauth/oauth.constants';

/**
 * OAuth part of the environment contract. Every provider variable is optional:
 * a provider turns itself on once its own variables are present, so a
 * deployment can ship with none of them set.
 */
export interface OAuthEnvironmentConfig {
  OAUTH_STATE_SECRET: string;
  OAUTH_CALLBACK_BASE_URL?: string;

  OAUTH_GOOGLE_CLIENT_ID?: string;
  OAUTH_GOOGLE_CLIENT_SECRET?: string;
  OAUTH_GOOGLE_CALLBACK_URL?: string;

  OAUTH_FACEBOOK_CLIENT_ID?: string;
  OAUTH_FACEBOOK_CLIENT_SECRET?: string;
  OAUTH_FACEBOOK_CALLBACK_URL?: string;

  OAUTH_GITHUB_CLIENT_ID?: string;
  OAUTH_GITHUB_CLIENT_SECRET?: string;
  OAUTH_GITHUB_CALLBACK_URL?: string;

  OAUTH_MICROSOFT_CLIENT_ID?: string;
  OAUTH_MICROSOFT_CLIENT_SECRET?: string;
  OAUTH_MICROSOFT_CALLBACK_URL?: string;
  /** Entra ID tenant segment of the authorize and token URLs. Defaults to `common`. */
  OAUTH_MICROSOFT_TENANT?: string;

  /** Apple Services ID. Apple has no static client secret; it is signed per request. */
  OAUTH_APPLE_CLIENT_ID?: string;
  OAUTH_APPLE_CALLBACK_URL?: string;
  OAUTH_APPLE_TEAM_ID?: string;
  OAUTH_APPLE_KEY_ID?: string;
  /** Contents of the .p8 sign-in key, with newlines written as \n. */
  OAUTH_APPLE_PRIVATE_KEY?: string;

  OAUTH_DISCORD_CLIENT_ID?: string;
  OAUTH_DISCORD_CLIENT_SECRET?: string;
  OAUTH_DISCORD_CALLBACK_URL?: string;

  OAUTH_LINKEDIN_CLIENT_ID?: string;
  OAUTH_LINKEDIN_CLIENT_SECRET?: string;
  OAUTH_LINKEDIN_CALLBACK_URL?: string;
}

/** Base class of EnvironmentVariables. class-validator reads inherited decorators. */
export class OAuthEnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @MinLength(OAUTH_STATE_SECRET_MIN_LENGTH, {
    message: `OAUTH_STATE_SECRET must be at least ${OAUTH_STATE_SECRET_MIN_LENGTH} characters`,
  })
  OAUTH_STATE_SECRET!: string;

  @IsString()
  @IsUrl({ require_protocol: true, require_tld: false })
  @IsOptional()
  OAUTH_CALLBACK_BASE_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_FACEBOOK_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_FACEBOOK_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_FACEBOOK_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_GITHUB_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_GITHUB_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_GITHUB_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_MICROSOFT_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_MICROSOFT_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_MICROSOFT_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_MICROSOFT_TENANT?: string;

  @IsString()
  @IsOptional()
  OAUTH_APPLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_APPLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_APPLE_TEAM_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_APPLE_KEY_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_APPLE_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  OAUTH_DISCORD_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_DISCORD_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_DISCORD_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  OAUTH_LINKEDIN_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_LINKEDIN_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_LINKEDIN_CALLBACK_URL?: string;
}
