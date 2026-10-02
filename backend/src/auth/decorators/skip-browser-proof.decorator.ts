import { SetMetadata } from '@nestjs/common';

export const SKIP_BROWSER_PROOF = 'skipBrowserProof';

/** Provider form callbacks prove themselves with state, not the app CSRF header. */
export const SkipBrowserProof = () => SetMetadata(SKIP_BROWSER_PROOF, true);
