export function boundLabel(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return '';
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength);
}
