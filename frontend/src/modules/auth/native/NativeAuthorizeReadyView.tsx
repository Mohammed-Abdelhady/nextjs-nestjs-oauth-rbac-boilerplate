'use client';

import type { RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getInitials } from '@/lib/formatters';
import type { NativeAuthorizeAction } from './useNativeAuthorize';

interface NativeAuthorizeReadyViewProps {
  applicationName: string;
  accountName: string;
  accountEmail: string;
  action: NativeAuthorizeAction | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onApprove: () => void;
  onDeny: () => void;
  onNotYou: () => void;
}

/** The confirmation card: the account to check and the app on the phone. */
export function NativeAuthorizeReadyView({
  applicationName,
  accountName,
  accountEmail,
  action,
  headingRef,
  onApprove,
  onDeny,
  onNotYou,
}: NativeAuthorizeReadyViewProps) {
  const t = useTranslations('auth.nativeAuthorize');
  const busy = action !== null;

  return (
    <section className="mx-auto mt-12 w-full max-w-sm" data-testid="native-authorize-ready">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-secondary text-primary text-sm font-medium">
            {getInitials(accountName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{accountName}</p>
          <p className="truncate text-sm text-muted-foreground">{accountEmail}</p>
        </div>
        <Button
          type="button"
          variant="link"
          onClick={onNotYou}
          disabled={busy}
          className="h-11 shrink-0 px-2"
          data-testid="native-authorize-not-you"
        >
          {t('notYou')}
        </Button>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-extrabold text-foreground">
        {t('title', { application: applicationName })}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('accountStatement')}</p>

      <div className="mt-6 space-y-3">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={onApprove}
          disabled={busy}
          aria-busy={action === 'approve'}
          data-testid="native-authorize-approve"
        >
          {action === 'approve' ? (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {t('approve')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={onDeny}
          disabled={busy}
          aria-busy={action === 'deny'}
          data-testid="native-authorize-deny"
        >
          {action === 'deny' && (
            <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          )}
          {t('deny')}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t('returnNote')}</p>
    </section>
  );
}
