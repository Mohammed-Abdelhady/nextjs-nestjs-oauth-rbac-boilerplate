export function getLoggableRequestPath(originalUrl: string): string {
  const path = originalUrl.split('?')[0];
  return path.replace(
    /^(\/api\/oauth\/authorize\/transaction)\/[^/]+(?=\/|$)/,
    '$1/[redacted]',
  );
}
