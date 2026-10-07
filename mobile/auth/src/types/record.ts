export interface AuthRecordFields {
  schemaVersion: number;
  serverBaseAddress: string;
  environment: string;
  clientId: string;
  installDigest: string;
}

export type AuthRecord = SessionAuthRecord | PendingAuthRecord;

export interface SessionAuthRecord extends AuthRecordFields {
  lineageId: string;
  tokens: StoredTokens;
  proofKeyThumbprint?: string;
  authorizationOperationId?: undefined;
  transaction?: undefined;
  refreshInFlight?: boolean;
}

export interface PendingAuthRecord extends AuthRecordFields {
  lineageId?: string;
  proofKeyThumbprint?: undefined;
  tokens?: undefined;
  authorizationOperationId?: string;
  transaction?: AuthTransaction;
  refreshInFlight?: undefined;
}

export type LegacyTokenRecord = AuthRecordFields & {
  lineageId?: undefined;
  tokens: StoredTokens;
  proofKeyThumbprint?: string;
  authorizationOperationId?: undefined;
  transaction?: undefined;
  refreshInFlight?: boolean;
};

export type StoredAuthRecord = AuthRecord | LegacyTokenRecord;

export interface AuthTransaction {
  verifier: string;
  state: string;
  returnAddress: string;
  createdAt: number;
  expiresAt: number;
  operationId: string;
}

export interface StoredTokens {
  refreshToken: string;
}

export interface RuntimeTokens extends StoredTokens {
  accessToken: string;
  expiresAt: number;
  version: number;
  lineageId: string;
  proofKeyThumbprint?: string;
}
