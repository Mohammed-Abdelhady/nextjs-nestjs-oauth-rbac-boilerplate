import { PasskeyDocument } from '../schemas/passkey.schema';
import { PasskeySummaryDto } from '../dto/passkey-summary.dto';

/** What a passkey looks like outside the server: no key, no counter, no id. */
export function toPasskeySummary(passkey: PasskeyDocument): PasskeySummaryDto {
  return {
    id: passkey._id.toString(),
    name: passkey.name,
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt,
  };
}
