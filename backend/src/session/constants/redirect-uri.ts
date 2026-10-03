export const DISALLOWED_REDIRECT_URI_SCHEMES: ReadonlySet<string> = new Set([
  'javascript',
  'data',
  'vbscript',
  'blob',
  'file',
]);
