'use client';

import { useState, useEffect, Activity } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TimelineList } from '@/components/design-system';
import { SessionCardTimeline } from '@/modules/sessions/components/SessionCardTimeline';
import { RevokeAllSessionsButton } from '@/modules/sessions/components/RevokeAllSessionsButton';
import { useGetSessionsQuery } from '@/modules/sessions';
import { parseApiError } from '@/lib/apiError';

/**
 * Sessions management page - Redesigned with timeline view
 * Displays all active sessions with device info and logout actions
 * Accessible at /[locale]/sessions
 */
export default function SessionsPage() {
  const t = useTranslations('sessions');
  const tCommon = useTranslations('common');
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldAnimate(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const {
    data: sessions,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSessionsQuery(undefined, {
    pollingInterval: 30000, // Auto-refresh every 30 seconds
  });

  const otherSessionsCount = sessions?.filter((s) => !s.isCurrent).length || 0;
  const currentSessionIndex = sessions?.findIndex((s) => s.isCurrent) ?? -1;

  return (
    <div className="container max-w-4xl py-8 px-4" data-testid="sessions-page">
      {/* Header */}
      <div className="my-8 ">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{t('description')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              data-testid="refresh-sessions-button"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
            <RevokeAllSessionsButton otherSessionsCount={otherSessionsCount} />
          </div>
        </div>

        <Alert variant="warning" className="mt-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>{t('securityWarning')}</AlertDescription>
        </Alert>
      </div>

      {/* Loading State */}
      <Activity mode={isLoading ? 'visible' : 'hidden'}>
        <div className="flex items-center justify-center py-12" data-testid="loading-skeleton">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </div>
      </Activity>

      {/* Error State */}
      <Activity mode={isError ? 'visible' : 'hidden'}>
        <Alert variant="destructive" data-testid="error-state">
          <AlertDescription className="flex items-center justify-between">
            <span>
              {t('loadError')} {error ? parseApiError(error).message : t('tryAgain')}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {tCommon('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </Activity>

      {/* Empty State */}
      <Activity mode={!isLoading && !isError && sessions?.length === 0 ? 'visible' : 'hidden'}>
        <div
          className="flex items-center justify-center py-12 text-center"
          data-testid="empty-state"
        >
          <div className="space-y-3">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">{t('noSessions')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{t('noSessionsDescription')}</p>
          </div>
        </div>
      </Activity>

      {/* Sessions Timeline */}
      <Activity
        mode={!isLoading && !isError && sessions && sessions.length > 0 ? 'visible' : 'hidden'}
      >
        <TimelineList
          items={sessions || []}
          renderItem={(session) => <SessionCardTimeline session={session} />}
          highlightIndex={currentSessionIndex}
          stagger={shouldAnimate}
        />
      </Activity>
    </div>
  );
}
