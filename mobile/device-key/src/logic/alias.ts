import {
  ALIAS_ESCAPE,
  ALIAS_ESCAPE_DIGITS,
  ALIAS_MAX_LENGTH,
  ALIAS_PREFIX,
  ALIAS_PROTECTION_PART,
  ALIAS_SEPARATOR,
  ALIAS_TOO_LONG_MESSAGE,
} from '../constants';
import type { DeviceKeySettings } from '../types/device-key';

const HEX_RADIX = 16;

function escapePart(part: string): string {
  return part.replace(
    /[^A-Za-z0-9-]/g,
    (character) =>
      ALIAS_ESCAPE + character.charCodeAt(0).toString(HEX_RADIX).padStart(ALIAS_ESCAPE_DIGITS, '0'),
  );
}

/**
 * One key per client id, environment and protection choice. The separator and
 * the escape character are escaped inside a part, so two different settings
 * never share a key, and a software key never answers for a hardware one.
 */
export function keyAlias({ clientId, environment, protection }: DeviceKeySettings): string {
  const alias = [
    ALIAS_PREFIX,
    ALIAS_PROTECTION_PART[protection],
    escapePart(clientId),
    escapePart(environment),
  ].join(ALIAS_SEPARATOR);
  if (alias.length > ALIAS_MAX_LENGTH) throw new TypeError(ALIAS_TOO_LONG_MESSAGE);
  return alias;
}
