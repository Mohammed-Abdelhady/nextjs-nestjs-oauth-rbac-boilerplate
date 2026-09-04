import { createOAuthConfig, OAuthConfig } from './oauth.config';

export { EnvironmentConfig, EnvironmentVariables } from './env.schema';

export interface Configuration {
  server: {
    port: number;
    nodeEnv: string;
    apiUrl: string;
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
  auth: {
    passwordEnabled: boolean;
  };
  magicLink: {
    enabled: boolean;
    expiresIn: number;
    maxPerHour: number;
  };
  swagger: {
    enabled: boolean;
  };
  profileSync: {
    enabled: boolean;
    fields: string;
  };
  oauth: OAuthConfig;
}

/** Magic links need somewhere to send mail from, so they follow SMTP. */
const isSmtpConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);

const configuration = (): Configuration => {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  const apiUrl = process.env.API_URL || `http://localhost:${port}`;

  return {
    server: {
      port,
      nodeEnv: process.env.NODE_ENV || 'development',
      apiUrl,
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
    auth: {
      passwordEnabled: process.env.AUTH_PASSWORD_ENABLED !== 'false',
    },
    magicLink: {
      enabled: process.env.MAGIC_LINK_ENABLED
        ? process.env.MAGIC_LINK_ENABLED === 'true'
        : isSmtpConfigured(),
      expiresIn: Number.parseInt(
        process.env.MAGIC_LINK_EXPIRES_IN || '900000',
        10,
      ),
      maxPerHour: Number.parseInt(
        process.env.MAGIC_LINK_MAX_PER_HOUR || '5',
        10,
      ),
    },
    swagger: {
      enabled: process.env.SWAGGER_ENABLED === 'true',
    },
    profileSync: {
      enabled: process.env.PROFILE_SYNC_ENABLED !== 'false',
      fields: process.env.PROFILE_SYNC_FIELDS || 'name,picture',
    },
    oauth: createOAuthConfig(apiUrl),
  };
};

export default configuration;
