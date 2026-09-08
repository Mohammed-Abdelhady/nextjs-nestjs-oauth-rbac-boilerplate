/** Light border the specification asks for, in modules. */
export const QR_QUIET_ZONE = 4;

/**
 * One SVG path covering every dark module, each drawn as a unit square. A
 * single path keeps the element count flat regardless of the version.
 */
export function qrPathData(modules: readonly boolean[][]): string {
  const parts: string[] = [];

  for (let row = 0; row < modules.length; row++) {
    for (let col = 0; col < modules[row].length; col++) {
      if (modules[row][col]) {
        parts.push(`M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`);
      }
    }
  }

  return parts.join('');
}
