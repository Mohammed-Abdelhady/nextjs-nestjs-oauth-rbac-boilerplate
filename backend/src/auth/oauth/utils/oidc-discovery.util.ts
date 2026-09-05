/**
 * OpenID Connect discovery for the generic provider. Everything a strategy
 * needs to talk to an issuer is either read from `/.well-known/openid-configuration`
 * or given by hand in the environment.
 */

/** Endpoints and capabilities the generic OIDC strategy runs on. */
export interface OidcEndpoints {
  /** Value id_tokens must carry as `iss`, without a trailing slash. */
  issuer: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  jwksUri: string;
  /** Issuer advertises S256 in `code_challenge_methods_supported`. */
  supportsPkceS256: boolean;
  /** Signing algorithms accepted on the id_token. */
  signingAlgorithms: string[];
}

/** Endpoints given by hand, for an issuer that publishes no document. */
export interface OidcEndpointOverrides {
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  jwksUri?: string;
}

interface OidcDiscoveryDocument {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  code_challenge_methods_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
}

const DISCOVERY_PATH = '/.well-known/openid-configuration';
const DISCOVERY_TIMEOUT_MS = 10000;
const PKCE_METHOD = 'S256';

/**
 * Signature algorithms allowed on an id_token. Symmetric algorithms are left
 * out on purpose: they would let anyone holding the client secret mint a token,
 * and `none` is not a signature at all.
 */
const ALLOWED_SIGNING_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
  'ES256',
  'ES384',
  'ES512',
];

const DEFAULT_SIGNING_ALGORITHMS = ['RS256'];

/** Drops a trailing slash so two spellings of one issuer compare equal. */
export function normalizeIssuer(issuer: string): string {
  return issuer.trim().replace(/\/$/, '');
}

export function discoveryUrl(issuer: string): string {
  return `${normalizeIssuer(issuer)}${DISCOVERY_PATH}`;
}

/**
 * Endpoints from the environment alone. Returns undefined unless all four are
 * given, because a half filled set cannot answer a login on its own.
 */
export function resolveManualEndpoints(
  issuer: string,
  overrides: OidcEndpointOverrides,
): OidcEndpoints | undefined {
  const { authorizationUrl, tokenUrl, userInfoUrl, jwksUri } = overrides;
  if (!authorizationUrl || !tokenUrl || !userInfoUrl || !jwksUri) {
    return undefined;
  }

  return {
    issuer: normalizeIssuer(issuer),
    authorizationUrl,
    tokenUrl,
    userInfoUrl,
    jwksUri,
    // No document to read the capability from, so PKCE stays off.
    supportsPkceS256: false,
    signingAlgorithms: DEFAULT_SIGNING_ALGORITHMS,
  };
}

/**
 * Reads the discovery document and turns it into endpoints. Environment
 * overrides win over the published values.
 *
 * @throws Error when the document is unreachable, malformed, or issued for a
 * different issuer than the one configured
 */
export async function discoverEndpoints(
  issuer: string,
  overrides: OidcEndpointOverrides = {},
): Promise<OidcEndpoints> {
  const expectedIssuer = normalizeIssuer(issuer);
  const document = await fetchDiscoveryDocument(expectedIssuer);

  if (!document.issuer || normalizeIssuer(document.issuer) !== expectedIssuer) {
    throw new Error(
      `discovery document is issued for '${document.issuer ?? 'nothing'}', not '${expectedIssuer}'`,
    );
  }

  const authorizationUrl =
    overrides.authorizationUrl ?? document.authorization_endpoint;
  const tokenUrl = overrides.tokenUrl ?? document.token_endpoint;
  const userInfoUrl = overrides.userInfoUrl ?? document.userinfo_endpoint;
  const jwksUri = overrides.jwksUri ?? document.jwks_uri;

  if (!authorizationUrl || !tokenUrl || !userInfoUrl || !jwksUri) {
    throw new Error(
      'discovery document is missing an authorization, token, userinfo or JWKS endpoint',
    );
  }

  return {
    issuer: expectedIssuer,
    authorizationUrl,
    tokenUrl,
    userInfoUrl,
    jwksUri,
    supportsPkceS256:
      document.code_challenge_methods_supported?.includes(PKCE_METHOD) === true,
    signingAlgorithms: readSigningAlgorithms(document),
  };
}

async function fetchDiscoveryDocument(
  issuer: string,
): Promise<OidcDiscoveryDocument> {
  const response = await fetch(discoveryUrl(issuer), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `discovery request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as OidcDiscoveryDocument;
}

function readSigningAlgorithms(document: OidcDiscoveryDocument): string[] {
  const published = document.id_token_signing_alg_values_supported ?? [];
  const allowed = published.filter((algorithm) =>
    ALLOWED_SIGNING_ALGORITHMS.includes(algorithm),
  );

  return allowed.length > 0 ? allowed : DEFAULT_SIGNING_ALGORITHMS;
}
