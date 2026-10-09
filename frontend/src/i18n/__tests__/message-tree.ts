export type MessageTree = { [key: string]: string | MessageTree };

export function isMessageTree(value: unknown): value is MessageTree {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function lookupMessage(messages: unknown, key: string): string {
  let current: unknown = messages;
  const parts = key.split('.');
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!isMessageTree(current) || part === undefined) {
      throw new Error(`Expected a message tree at ${key}`);
    }
    const next: unknown = current[part];
    if (typeof next === 'string') {
      if (index === parts.length - 1) {
        return next;
      }
      throw new Error(`Expected a message tree at ${key}`);
    }
    if (next === undefined) {
      throw new Error(`Missing message for key ${key}`);
    }
    current = next;
  }
  throw new Error(`Expected a message string for key ${key}`);
}
