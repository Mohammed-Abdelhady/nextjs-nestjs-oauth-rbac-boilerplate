import type { MouseEvent } from 'react';

export function preventNavigationBlur(event: MouseEvent<HTMLAnchorElement>): void {
  // Blur validation can move a lower form link between pointer down and click.
  if (event.button === 0) event.preventDefault();
}
