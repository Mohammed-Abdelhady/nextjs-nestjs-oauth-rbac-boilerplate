import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PasskeyChallengeService } from './services/passkey-challenge.service';
import { PasskeyConfigService } from './services/passkey-config.service';
import { PasskeyCredentialDto } from './dto/passkey-credential.dto';

/**
 * Shared setup for the passkey specs.
 * The file ends in -spec.ts rather than .spec.ts: the build excludes it and
 * jest does not collect it as a suite of its own.
 */

export const USER_ID = new Types.ObjectId('507f1f77bcf86cd799439011');
export const OTHER_USER_ID = new Types.ObjectId('507f1f77bcf86cd799439099');
export const PASSKEY_ID = new Types.ObjectId('507f1f77bcf86cd799439022');
export const STATE_SECRET = 'z'.repeat(32);
export const RP_ID = 'localhost';
export const ORIGIN = 'http://localhost:3000';
export const CREDENTIAL_ID = 'Y3JlZGVudGlhbC1pZA';

/** Configuration the passkey services read, with test values. */
export const PASSKEY_CONFIG: Record<string, string> = {
  'oauth.stateSecret': STATE_SECRET,
  'passkeys.rpId': RP_ID,
  'passkeys.rpName': 'Test App',
  'passkeys.origin': ORIGIN,
  NODE_ENV: 'test',
};

export function createConfigService(
  values: Record<string, string> = PASSKEY_CONFIG,
): ConfigService {
  return {
    get: <T>(key: string, fallback?: T): T | undefined =>
      (values[key] as T | undefined) ?? fallback,
  } as unknown as ConfigService;
}

export function createChallengeService(
  values?: Record<string, string>,
): PasskeyChallengeService {
  return new PasskeyChallengeService(createConfigService(values));
}

export function createPasskeyConfig(): PasskeyConfigService {
  return new PasskeyConfigService(createConfigService());
}

/** A credential body, standing in for what the browser would send. */
export const CREDENTIAL_BODY = {
  id: CREDENTIAL_ID,
  rawId: CREDENTIAL_ID,
  response: {},
  clientExtensionResults: {},
  type: 'public-key',
} as PasskeyCredentialDto;

export interface MockPasskey {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  deviceType?: string;
  backedUp: boolean;
  name: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  save: jest.Mock;
}

export function createMockPasskey(
  overrides: Partial<MockPasskey> = {},
): MockPasskey {
  return {
    _id: PASSKEY_ID,
    user: USER_ID,
    credentialId: CREDENTIAL_ID,
    publicKey: Buffer.from([1, 2, 3]),
    counter: 4,
    transports: ['internal'],
    deviceType: 'multiDevice',
    backedUp: true,
    name: 'Test key',
    lastUsedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** Response double that records the cookies a service sets and clears. */
export interface MockResponse {
  response: Response;
  cookies: Record<string, string>;
  cleared: string[];
}

export function createMockResponse(): MockResponse {
  const cookies: Record<string, string> = {};
  const cleared: string[] = [];

  const response = {
    cookie: (name: string, value: string): void => {
      cookies[name] = value;
    },
    clearCookie: (name: string): void => {
      cleared.push(name);
    },
    req: { headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' },
  } as unknown as Response;

  return { response, cookies, cleared };
}

export function createMockRequest(cookies: Record<string, string>): Request {
  return { cookies } as unknown as Request;
}
