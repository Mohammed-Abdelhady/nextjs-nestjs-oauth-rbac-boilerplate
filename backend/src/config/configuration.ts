import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

/**
 * Environment configuration interface
 * Defines all required and optional environment variables for the application
 */
export interface EnvironmentConfig {
  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;

  // Database
  MONGO_URI: string;

  // Client
  CLIENT_URL: string;

  // Rate Limiting
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;

  // Security (optional, will be added later)
  JWT_SECRET?: string;
  MAIL_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  FACEBOOK_APP_ID?: string;

  // OAuth
  OAUTH_GOOGLE_CLIENT_ID?: string;
  OAUTH_GOOGLE_CLIENT_SECRET?: string;
  OAUTH_GOOGLE_CALLBACK_URL?: string;
  OAUTH_FACEBOOK_CLIENT_ID?: string;
  OAUTH_FACEBOOK_CLIENT_SECRET?: string;
  OAUTH_FACEBOOK_CALLBACK_URL?: string;
  OAUTH_GITHUB_CLIENT_ID?: string;
  OAUTH_GITHUB_CLIENT_SECRET?: string;
  OAUTH_GITHUB_CALLBACK_URL?: string;

  // SMTP
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;

  // Bcrypt
  BCRYPT_ROUNDS?: number;

  // Session
  SESSION_COOKIE_NAME?: string;
  SESSION_COOKIE_MAX_AGE?: number;

  // Activation
  ACTIVATION_CODE_EXPIRES_IN?: number;
  ACTIVATION_MAX_ATTEMPTS?: number;
}

/**
 * Environment configuration class with validation decorators
 * Uses class-validator to ensure environment variables are valid on startup
 */
export class EnvironmentVariables {
  @IsEnum(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  @Min(1000)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  MONGO_URI: string = 'mongodb://localhost:27017/authboiler';

  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true })
  CLIENT_URL: string = 'http://localhost:3000';

  @IsInt()
  @Min(1)
  @Max(3600)
  THROTTLE_TTL: number = 60;

  @IsInt()
  @Min(1)
  @Max(1000)
  THROTTLE_LIMIT: number = 60;

  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  MAIL_KEY?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  FACEBOOK_APP_ID?: string;

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

  // SMTP
  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  SMTP_PORT?: number;

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

  // Bcrypt
  @IsInt()
  @Min(4)
  @Max(12)
  @IsOptional()
  BCRYPT_ROUNDS?: number;

  // Session
  @IsString()
  @IsOptional()
  SESSION_COOKIE_NAME?: string;

  @IsInt()
  @Min(1000)
  @IsOptional()
  SESSION_COOKIE_MAX_AGE?: number;

  // Activation
  @IsInt()
  @Min(60000)
  @IsOptional()
  ACTIVATION_CODE_EXPIRES_IN?: number;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  ACTIVATION_MAX_ATTEMPTS?: number;
}

/**
 * Configuration factory function
 * Returns a structured configuration object with type safety
 */
export interface Configuration {
  server: {
    port: number;
    nodeEnv: string;
  };
  database: {
    uri: string;
  };
  cors: {
    clientUrl: string;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  smtp: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
    from?: string;
  };
  bcrypt: {
    rounds: number;
  };
  session: {
    cookieName: string;
    cookieMaxAge: number;
  };
  activation: {
    codeExpiresIn: number;
    maxAttempts: number;
  };
  oauth: {
    google: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
    };
    facebook: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
    };
    github: {
      enabled: boolean;
      clientId?: string;
      clientSecret?: string;
      callbackUrl?: string;
    };
  };
}

const configuration = (): Configuration => ({
  server: {
    port: Number.parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017/authboiler',
  },
  cors: {
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  },
  throttle: {
    ttl: Number.parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: Number.parseInt(process.env.THROTTLE_LIMIT || '60', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT
      ? Number.parseInt(process.env.SMTP_PORT, 10)
      : undefined,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM,
  },
  bcrypt: {
    rounds: Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },
  session: {
    cookieName:
      process.env.SESSION_COOKIE_NAME ||
      (process.env.NODE_ENV === 'production' ? '__Host-sid' : 'sid'),
    cookieMaxAge: Number.parseInt(
      process.env.SESSION_COOKIE_MAX_AGE || '604800000',
      10,
    ),
  },
  activation: {
    codeExpiresIn: Number.parseInt(
      process.env.ACTIVATION_CODE_EXPIRES_IN || '900000',
      10,
    ),
    maxAttempts: Number.parseInt(
      process.env.ACTIVATION_MAX_ATTEMPTS || '5',
      10,
    ),
  },
  oauth: {
    google: {
      enabled: !!(
        process.env.OAUTH_GOOGLE_CLIENT_ID &&
        process.env.OAUTH_GOOGLE_CLIENT_SECRET &&
        process.env.OAUTH_GOOGLE_CALLBACK_URL
      ),
      clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
      clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.OAUTH_GOOGLE_CALLBACK_URL,
    },
    facebook: {
      enabled: !!(
        process.env.OAUTH_FACEBOOK_CLIENT_ID &&
        process.env.OAUTH_FACEBOOK_CLIENT_SECRET &&
        process.env.OAUTH_FACEBOOK_CALLBACK_URL
      ),
      clientId: process.env.OAUTH_FACEBOOK_CLIENT_ID,
      clientSecret: process.env.OAUTH_FACEBOOK_CLIENT_SECRET,
      callbackUrl: process.env.OAUTH_FACEBOOK_CALLBACK_URL,
    },
    github: {
      enabled: !!(
        process.env.OAUTH_GITHUB_CLIENT_ID &&
        process.env.OAUTH_GITHUB_CLIENT_SECRET &&
        process.env.OAUTH_GITHUB_CALLBACK_URL
      ),
      clientId: process.env.OAUTH_GITHUB_CLIENT_ID,
      clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
      callbackUrl: process.env.OAUTH_GITHUB_CALLBACK_URL,
    },
  },
});

export default configuration;
