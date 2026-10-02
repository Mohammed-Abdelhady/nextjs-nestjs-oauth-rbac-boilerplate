/** Values a catalogue message can be formatted with. */
export type MessageValues = Record<string, string | number>;

/** Names of the arguments an ICU message needs, sorted and without repeats. */
export function icuArgNames(message: string): string[] {
  const names = new Set<string>();
  const pattern = /\{(\w+)(?:\s*,|\s*\})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const name = match[1];
    if (name !== undefined) {
      names.add(name);
    }
  }
  return [...names].sort();
}

/** The strings and numbers of a record, which is what a message can take as arguments. */
export function toMessageValues(source: unknown): MessageValues {
  const values: MessageValues = {};
  if (typeof source !== 'object' || source === null) {
    return values;
  }
  for (const [name, value] of Object.entries(source)) {
    if (typeof value === 'string' || typeof value === 'number') {
      values[name] = value;
    }
  }
  return values;
}
