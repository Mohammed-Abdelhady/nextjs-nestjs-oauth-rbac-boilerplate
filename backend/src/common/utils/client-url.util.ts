import { ConfigService } from '@nestjs/config';

const DEFAULT_CLIENT_URL = 'http://localhost:3000';

/** The configured client base URL without a trailing slash. */
export function clientBaseUrl(configService: ConfigService): string {
  const clientUrl = configService.get<string>(
    'cors.clientUrl',
    DEFAULT_CLIENT_URL,
  );
  return clientUrl.replace(/\/$/, '');
}

/**
 * An absolute client URL for a path, with optional query values. Used by every
 * mail that carries a link, so all of them read the base URL the same way.
 */
export function buildClientUrl(
  configService: ConfigService,
  path: string,
  params: Record<string, string> = {},
): string {
  const url = new URL(`${clientBaseUrl(configService)}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
