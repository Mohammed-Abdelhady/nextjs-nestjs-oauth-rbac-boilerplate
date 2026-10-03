import { UTF16_BOM_BYTES, UTF16_ENCODINGS } from './policy.mjs';

function utf16Encoding(content) {
  if (content.length < UTF16_BOM_BYTES) return undefined;
  return UTF16_ENCODINGS.find(({ bom }) => bom.every((byte, index) => content[index] === byte))
    ?.encoding;
}

export function isUtf16(content) {
  return utf16Encoding(content) !== undefined;
}

export function decodeContent(content) {
  const encoding = utf16Encoding(content);
  return encoding ? new TextDecoder(encoding).decode(content) : content.toString('utf8');
}
