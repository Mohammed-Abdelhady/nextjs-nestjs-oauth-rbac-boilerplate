const CHANNEL_MAX = 255;

/** Relative luminance of one sRGB channel, as WCAG 2 defines it. */
function linear(channel: number): number {
  const value = channel / CHANNEL_MAX;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (digits === null) throw new Error(`Not a six-digit colour: ${hex}`);
  const [red = 0, green = 0, blue = 0] = digits
    .slice(1)
    .map((pair) => linear(Number.parseInt(pair, 16)));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const [lighter = 0, darker = 0] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
