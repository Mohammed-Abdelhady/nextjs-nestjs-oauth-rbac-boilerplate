/**
 * Helmet CSP for non-production. Production keeps Helmet's default policy
 * (`undefined` on the option). Dev still sends a policy; it just skips
 * `upgrade-insecure-requests` so localhost HTTP keeps working.
 */
export const DEVELOPMENT_CONTENT_SECURITY_POLICY = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: null,
  },
};
