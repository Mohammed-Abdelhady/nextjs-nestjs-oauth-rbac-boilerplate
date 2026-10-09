import type { AuthConfiguration } from '@app/native-auth';
import {
  APP_CALLBACK_URI,
  APP_CLIENT_ID,
  AUTH_SCOPE,
  DEVELOPMENT_ENVIRONMENT,
  DEVELOPMENT_API_ORIGIN,
  PRODUCTION_ENVIRONMENT,
  PRODUCTION_API_ORIGIN,
} from './constants';

declare const __DEV__: boolean;

export const API_ORIGIN = __DEV__ ? DEVELOPMENT_API_ORIGIN : PRODUCTION_API_ORIGIN;

export const AUTH_CONFIGURATION: AuthConfiguration = {
  serverBaseAddress: API_ORIGIN,
  environment: __DEV__ ? DEVELOPMENT_ENVIRONMENT : PRODUCTION_ENVIRONMENT,
  clientId: APP_CLIENT_ID,
  redirectUri: APP_CALLBACK_URI,
  scopes: [AUTH_SCOPE],
};

export const EPHEMERAL_BROWSER_SESSION = true;
