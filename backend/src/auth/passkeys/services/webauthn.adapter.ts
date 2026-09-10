import { Injectable, Logger } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { PASSKEY_CEREMONY_TIMEOUT_MS } from '../constants/passkeys.constants';

/**
 * The only file that talks to @simplewebauthn/server. Everything else works
 * against the shapes below, so a library upgrade is a change here and nowhere
 * else, and the specs can stand in for the library at one seam.
 */

export type PasskeyCreationOptions = PublicKeyCredentialCreationOptionsJSON;
export type PasskeyRequestOptions = PublicKeyCredentialRequestOptionsJSON;

/**
 * A credential as the browser serialises it. Kept deliberately loose: the
 * request DTO checks the envelope, and the library parses and authenticates
 * everything inside `response` itself.
 */
export interface PasskeyCredentialJson {
  id: string;
  rawId: string;
  response: Record<string, unknown>;
  authenticatorAttachment?: string;
  clientExtensionResults?: Record<string, unknown>;
  type: string;
}

export interface CredentialDescriptor {
  id: string;
  transports?: string[];
}

export interface RegistrationOptionsInput {
  rpId: string;
  rpName: string;
  userId: string;
  userName: string;
  userDisplayName: string;
  excludeCredentials: CredentialDescriptor[];
}

export interface AuthenticationOptionsInput {
  rpId: string;
  allowCredentials: CredentialDescriptor[];
}

export interface AttestationVerification {
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  deviceType?: string;
  backedUp: boolean;
}

export interface AssertionVerification {
  newCounter: number;
  userVerified: boolean;
}

export interface StoredCredential {
  id: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
}

export interface CeremonyExpectations {
  challenge: string;
  origin: string;
  rpId: string;
}

/** Library option shapes are wider than what the routes hand over. */
type LibraryDescriptor = NonNullable<
  PublicKeyCredentialRequestOptionsJSON['allowCredentials']
>[number];

function toLibraryDescriptors(
  credentials: CredentialDescriptor[],
): LibraryDescriptor[] {
  return credentials.map(
    (credential) => credential as unknown as LibraryDescriptor,
  );
}

/**
 * The one place a browser payload is handed to the library. `transports` and
 * `type` are open strings on the way in and unions in the library types; the
 * library re-reads and authenticates every field regardless.
 */
function toAttestation(
  credential: PasskeyCredentialJson,
): RegistrationResponseJSON {
  return credential as unknown as RegistrationResponseJSON;
}

function toAssertion(
  credential: PasskeyCredentialJson,
): AuthenticationResponseJSON {
  return credential as unknown as AuthenticationResponseJSON;
}

@Injectable()
export class WebAuthnAdapter {
  private readonly logger = new Logger(WebAuthnAdapter.name);

  /**
   * Registration options. `residentKey: 'preferred'` asks for a discoverable
   * credential, which is what lets the sign-in route work without an email.
   */
  async createRegistrationOptions(
    input: RegistrationOptionsInput,
  ): Promise<PasskeyCreationOptions> {
    return generateRegistrationOptions({
      rpID: input.rpId,
      rpName: input.rpName,
      userID: Uint8Array.from(Buffer.from(input.userId, 'utf8')),
      userName: input.userName,
      userDisplayName: input.userDisplayName,
      timeout: PASSKEY_CEREMONY_TIMEOUT_MS,
      attestationType: 'none',
      excludeCredentials: toLibraryDescriptors(input.excludeCredentials),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });
  }

  async createAuthenticationOptions(
    input: AuthenticationOptionsInput,
  ): Promise<PasskeyRequestOptions> {
    return generateAuthenticationOptions({
      rpID: input.rpId,
      timeout: PASSKEY_CEREMONY_TIMEOUT_MS,
      userVerification: 'preferred',
      allowCredentials: toLibraryDescriptors(input.allowCredentials),
    });
  }

  /**
   * @returns null when the attestation does not check out, whether the library
   * reported that or threw, which is what it does for a challenge, origin or
   * RP id that does not match and for a payload it cannot parse
   */
  async verifyAttestation(
    attestation: PasskeyCredentialJson,
    expected: CeremonyExpectations,
  ): Promise<AttestationVerification | null> {
    const result = await this.refused(() =>
      verifyRegistrationResponse({
        response: toAttestation(attestation),
        expectedChallenge: expected.challenge,
        expectedOrigin: expected.origin,
        expectedRPID: expected.rpId,
        requireUserVerification: false,
      }),
    );

    if (!result?.verified || !result.registrationInfo) {
      return null;
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      result.registrationInfo;

    return {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    };
  }

  /** @returns null when the signature does not check out, thrown or reported. */
  async verifyAssertion(
    assertion: PasskeyCredentialJson,
    credential: StoredCredential,
    expected: CeremonyExpectations,
  ): Promise<AssertionVerification | null> {
    const result = await this.refused(() =>
      verifyAuthenticationResponse({
        response: toAssertion(assertion),
        expectedChallenge: expected.challenge,
        expectedOrigin: expected.origin,
        expectedRPID: expected.rpId,
        requireUserVerification: false,
        credential: {
          id: credential.id,
          publicKey: Uint8Array.from(credential.publicKey),
          counter: credential.counter,
          transports: toLibraryTransports(credential.transports),
        },
      }),
    );

    if (!result?.verified) {
      return null;
    }

    return {
      newCounter: result.authenticationInfo.newCounter,
      userVerified: result.authenticationInfo.userVerified,
    };
  }

  /**
   * The library signals most rejections by throwing: a challenge, origin or RP
   * id that does not match, and any payload it cannot parse. Only a bad
   * signature comes back as `verified: false`. Both mean the same thing to the
   * caller, so both arrive as null and neither reaches the client as a 500.
   */
  private async refused<T>(verify: () => Promise<T>): Promise<T | null> {
    try {
      return await verify();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`WebAuthn check refused: ${reason}`);
      return null;
    }
  }
}

type LibraryTransports = NonNullable<LibraryDescriptor['transports']>;

/** Transports are stored as plain strings; the library types them as a union. */
function toLibraryTransports(transports: string[]): LibraryTransports {
  return transports;
}
