import type { AuthConfiguration } from '@app/native-auth';

/** The server's own example entry in `AUTH_NATIVE_APPLICATIONS`. */
export const NATIVE_CLIENT_ID = 'com.example.mobile';
/** Its scheme is the `scheme` in app.json. */
export const REDIRECT_URI = 'com.example.mobile://oauth/callback';
export const SCOPES = ['api'] as const;
export const DEVELOPMENT_API_ORIGIN = 'http://localhost:5001';
export const ENVIRONMENT = { DEVELOPMENT: 'development', PRODUCTION: 'production' } as const;
export const API_ORIGIN_VARIABLE = 'EXPO_PUBLIC_API_ORIGIN';

export interface ConfigInput {
  apiOrigin: string | undefined;
  development: boolean;
}

/** Only a development build falls back to the local server. */
export function resolveConfig({ apiOrigin, development }: ConfigInput): AuthConfiguration {
  const configured = apiOrigin?.trim();
  const origin = configured || (development ? DEVELOPMENT_API_ORIGIN : undefined);
  if (origin === undefined) throw new Error(`${API_ORIGIN_VARIABLE} is not set.`);
  return {
    serverBaseAddress: origin,
    environment: development ? ENVIRONMENT.DEVELOPMENT : ENVIRONMENT.PRODUCTION,
    clientId: NATIVE_CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
  };
}
