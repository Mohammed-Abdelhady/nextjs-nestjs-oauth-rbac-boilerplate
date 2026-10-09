export function processExists(
  pid: number,
  checkProcess: (pid: number) => void,
): boolean;

export function removeOrphanedDataDirectories(
  parentDirectory: string,
  prefix: string,
  isProcessAlive: (pid: number) => boolean,
): string[];
