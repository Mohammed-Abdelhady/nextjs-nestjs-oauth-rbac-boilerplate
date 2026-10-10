import type { INestApplication } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { startMongoE2eStorage } from './e2e-mongo-storage';

/** A seed account as the fixture stores it, its password already hashed. */
export interface E2eAccountFixture {
  email: string;
  name: string;
  role: string;
  permissions: string[];
  isVerified: boolean;
  password: string;
}

/** An application as a case registers it. */
export interface E2eApplication {
  clientId: string;
  displayName: string;
  platform: string;
  environment: string;
  clientType: string;
  enabled: boolean;
  redirectUris: string[];
  allowedOrigins: string[];
  audiences: string[];
  allowedScopes: string[];
  policy: { absoluteLifetimeMs: number; idleLifetimeMs: number };
  sessionVersion: number;
}

/**
 * What a case arranges and reads in the database without going through a
 * route. Each database's fixture answers these, so a case names what it needs
 * and never a collection or a table.
 */
export interface E2eState {
  createApplication(application: E2eApplication): Promise<void>;
  /** Stores accounts as given, an unverified one included. */
  seedAccounts(accounts: E2eAccountFixture[]): Promise<void>;
  /** The id of a session issued for this credential purpose, if there is one. */
  sessionIdWithPurpose(purpose: string): Promise<string | null>;
}

/** What a booted application's database gives the fixture between cases. */
export interface AttachedE2eStorage {
  readonly state: E2eState;
  /** Removes every stored row. */
  empty(): Promise<void>;
  /** Stores the first applications and allows the client origin. */
  seedApplications(): Promise<void>;
  seedAccounts(accounts: E2eAccountFixture[]): Promise<void>;
}

/**
 * The database one booted fixture owns. The fixture is the only thing that
 * knows which database a run is on: the application under test is told by its
 * environment, the way an installation is.
 */
export interface E2eStorage {
  /** The settings that point the application at this database. */
  readonly environment: Record<string, string>;
  /** Called on the testing module before it is compiled. */
  prepare(builder: TestingModuleBuilder): Promise<void>;
  attach(app: INestApplication): Promise<AttachedE2eStorage>;
  stop(): Promise<void>;
}

let startStorage: () => Promise<E2eStorage> = startMongoE2eStorage;

/**
 * Names the storage every fixture of this run boots on. A run on another
 * database calls it from its Jest setup file, before any suite is loaded. A
 * run that names none is on MongoDB.
 */
export function useE2eStorage(start: () => Promise<E2eStorage>): void {
  startStorage = start;
}

export function startE2eStorage(): Promise<E2eStorage> {
  return startStorage();
}
