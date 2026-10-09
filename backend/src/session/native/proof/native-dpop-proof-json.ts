export type NativeDpopJsonObject = Record<string, unknown>;

export type NativeDpopJsonResult =
  { ok: true; value: NativeDpopJsonObject } | { ok: false; duplicate: boolean };

export function parseNativeDpopJson(bytes: Buffer): NativeDpopJsonResult {
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) {
    return { ok: false, duplicate: false };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, duplicate: false };
  }
  if (!isObject(value)) {
    return { ok: false, duplicate: false };
  }

  try {
    if (hasDuplicateMember(text)) {
      return { ok: false, duplicate: true };
    }
  } catch {
    return { ok: false, duplicate: false };
  }
  return { ok: true, value };
}

function isObject(value: unknown): value is NativeDpopJsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasDuplicateMember(text: string): boolean {
  let offset = 0;

  const skipWhitespace = (): void => {
    while (['\t', '\n', '\r', ' '].includes(text[offset] ?? '')) {
      offset += 1;
    }
  };

  const readString = (): string => {
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const character = text[offset];
      if (character === '\\') {
        offset += 2;
        continue;
      }
      offset += 1;
      if (character === '"') {
        const value: unknown = JSON.parse(text.slice(start, offset));
        if (typeof value === 'string') {
          return value;
        }
      }
    }
    throw new Error('Invalid JSON string');
  };

  const parseValue = (): boolean => {
    skipWhitespace();
    const character = text[offset];
    if (character === '{') {
      return parseObject();
    }
    if (character === '[') {
      return parseArray();
    }
    if (character === '"') {
      readString();
      return false;
    }
    while (offset < text.length && !',]} \t\r\n'.includes(text[offset] ?? '')) {
      offset += 1;
    }
    return false;
  };

  const parseObject = (): boolean => {
    offset += 1;
    skipWhitespace();
    if (text[offset] === '}') {
      offset += 1;
      return false;
    }
    const names = new Set<string>();
    while (offset < text.length) {
      skipWhitespace();
      const name = readString();
      if (names.has(name)) {
        return true;
      }
      names.add(name);
      skipWhitespace();
      offset += 1;
      if (parseValue()) {
        return true;
      }
      skipWhitespace();
      if (text[offset] === '}') {
        offset += 1;
        return false;
      }
      offset += 1;
    }
    return false;
  };

  const parseArray = (): boolean => {
    offset += 1;
    skipWhitespace();
    if (text[offset] === ']') {
      offset += 1;
      return false;
    }
    while (offset < text.length) {
      if (parseValue()) {
        return true;
      }
      skipWhitespace();
      if (text[offset] === ']') {
        offset += 1;
        return false;
      }
      offset += 1;
    }
    return false;
  };

  return parseValue();
}
