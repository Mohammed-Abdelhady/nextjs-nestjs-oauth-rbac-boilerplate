'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SidebarPanel } from './SidebarPanel';

/**
 * Navigation drawer for viewports below `md`. Built on the Radix dialog through
 * `Sheet`, so it traps focus, sets `aria-modal`, closes on Escape and returns
 * focus to the trigger.
 */
export function MobileNavSheet(): React.JSX.Element {
  const t = useTranslations('dashboard.shell');
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t('openMenu')}
          data-testid="mobile-menu-button"
        >
          <Menu className="h-6 w-6" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="start"
        showCloseButton={false}
        overlayTestId="mobile-menu-backdrop"
        className="w-64 p-0 sm:max-w-none"
        data-testid="mobile-sidebar"
      >
        <SheetTitle className="sr-only">{t('navigationTitle')}</SheetTitle>
        <SheetDescription className="sr-only">{t('navigationDescription')}</SheetDescription>

        <SidebarPanel
          onNavigate={close}
          headerAction={
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('closeMenu')}
                data-testid="mobile-menu-close"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </Button>
            </SheetClose>
          }
        />
      </SheetContent>
    </Sheet>
  );
}
