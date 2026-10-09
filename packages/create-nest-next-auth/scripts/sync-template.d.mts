import type { Buffer } from 'node:buffer';

export function templateContent(relativePath: string, bytes: Buffer): Buffer;
export function isExcluded(relativePath: string, name: string, isDirectory: boolean): boolean;
