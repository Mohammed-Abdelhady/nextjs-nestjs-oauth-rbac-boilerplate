import { RECOVERY_CODES_FILENAME } from '../constants';

/** Copies text, reporting whether the browser allowed it. */
export async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** One code per line, the form people paste into a password manager. */
export function formatRecoveryCodes(codes: readonly string[]): string {
  return codes.join('\n');
}

/** Saves the codes as a text file through a short-lived blob URL. */
export function downloadRecoveryCodes(codes: readonly string[]): void {
  const blob = new Blob([`${formatRecoveryCodes(codes)}\n`], {
    type: 'text/plain;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = RECOVERY_CODES_FILENAME;
  link.click();

  URL.revokeObjectURL(url);
}
