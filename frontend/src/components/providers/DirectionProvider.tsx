'use client';

import { Direction } from 'radix-ui';
import { Toaster } from '@/components/ui/sonner';
import type { TextDirection } from '@/i18n/direction';

const TOAST_POSITION = {
  ltr: 'bottom-right',
  rtl: 'bottom-left',
} as const;

/**
 * Client boundary for direction-aware context.
 *
 * Radix reads the direction from React context, so the provider cannot be
 * rendered from a server layout. Toasts live here too because Sonner takes
 * the same `dir` and needs a matching corner.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: TextDirection;
  children: React.ReactNode;
}) {
  return (
    <Direction.DirectionProvider dir={dir}>
      {children}
      <Toaster dir={dir} position={TOAST_POSITION[dir]} />
    </Direction.DirectionProvider>
  );
}
