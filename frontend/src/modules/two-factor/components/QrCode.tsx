'use client';

import { useMemo } from 'react';
import { encodeQrCode, qrPathData, QR_QUIET_ZONE } from '@/lib/qr';

interface QrCodeProps {
  /** Payload the reader scans, an otpauth URL here. */
  value: string;
  /** Rendered size in pixels. */
  size?: number;
  /** Read out to a screen reader, which cannot scan the image. */
  label: string;
}

/**
 * Draws a QR code as inline SVG.
 *
 * Encoding runs in the browser, so the secret never leaves the page to reach
 * an image service. Returns null when the payload is too long for the largest
 * version the encoder covers; the caller shows the secret as text instead.
 */
export function QrCode({ value, size = 208, label }: QrCodeProps) {
  const code = useMemo(() => encodeQrCode(value), [value]);

  if (code === null) {
    return null;
  }

  const side = code.size + QR_QUIET_ZONE * 2;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${side} ${side}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      data-testid="two-factor-qr"
    >
      <rect width={side} height={side} fill="#ffffff" />
      <path d={qrPathData(code.modules)} fill="#000000" />
    </svg>
  );
}
