'use client';

import { memo, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, LogOut, MapPin, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteSessionMutation } from '../api/sessionsApi';
import { DeviceIcon } from './DeviceIcon';
import { CurrentSessionBadge } from './CurrentSessionBadge';
import { parseUserAgent, getDeviceLabel } from '@/lib/parseUserAgent';
import type { Session } from '../types/session.types';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/formatters';

interface SessionCardTimelineProps {
  readonly session: Session;
}

/**
 * SessionCardTimeline - Redesigned session card for timeline view
 *
 * Features:
 * - Timeline-style vertical layout
 * - Current session emphasized with pulsing border
 * - Device icon with metadata rows
 * - Minimal aesthetic with refined spacing
 * - Hover state for interactive sessions
 * - Optimized with React.memo for performance
 *
 * @example
 * ```tsx
 * <SessionCardTimeline session={session} />
 * ```
 */
export const SessionCardTimeline = memo(
  function SessionCardTimeline({ session }: SessionCardTimelineProps) {
    const t = useTranslations('sessions');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const [showConfirm, setShowConfirm] = useState(false);
    const [deleteSession, { isLoading }] = useDeleteSessionMutation();

    const { device, browser, os } = parseUserAgent(session.userAgent);
    const deviceLabel = getDeviceLabel(session.userAgent);

    const handleLogout = useCallback(async () => {
      try {
        await deleteSession(session.id).unwrap();
        toast.success(t('logoutSuccess'));
        setShowConfirm(false);
      } catch {
        toast.error(t('logoutError'));
      }
    }, [deleteSession, session.id, t]);

    const handleShowConfirm = useCallback(() => setShowConfirm(true), []);
    const handleHideConfirm = useCallback(() => setShowConfirm(false), []);

    const lastActivity = formatTimeAgo(session.lastUsedAt || session.createdAt, locale);
    const createdAt = formatTimeAgo(session.createdAt, locale);

    return (
      <>
        <article
          data-testid={`session-card-timeline-${session.id}`}
          className={cn(
            'relative p-4 rounded-lg transition-all duration-200',
            'bg-card',
            session.isCurrent
              ? 'border-2 border-status-success/30 shadow-md'
              : 'border border-border hover:border-input hover:shadow-sm',
          )}
        >
          {/* Device Header */}
          <header className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1">
              <DeviceIcon
                deviceType={device as 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown'}
                size="lg"
              />
              <div className="flex-1">
                <h3 className="text-sm font-medium tracking-tight flex items-center gap-2 text-card-foreground">
                  <span data-testid="session-device-label">
                    {session.deviceName || deviceLabel}
                  </span>
                  {session.isCurrent && <CurrentSessionBadge pulse />}
                </h3>
                <p className="text-sm text-card-foreground mt-0.5" data-testid="session-browser-os">
                  {browser} · {os}
                </p>
              </div>
            </div>

            {!session.isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowConfirm}
                disabled={isLoading}
                aria-busy={isLoading}
                aria-label={t('logoutThisDevice')}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 ms-2"
                data-testid="logout-session-button"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            )}
          </header>

          {/* Session Metadata */}
          <div className="space-y-1 text-sm text-card-foreground">
            <div className="flex items-center gap-2" data-testid="session-ip-row">
              <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span data-testid="session-ip">{session.ip}</span>
            </div>
            <div className="flex items-center gap-2" data-testid="session-last-activity-row">
              <Clock className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span data-testid="session-last-activity">
                {t('lastActive', { time: lastActivity })}
              </span>
            </div>
            <div className="flex items-center gap-2" data-testid="session-created-at-row">
              <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span data-testid="session-created-at">{t('loggedInAt', { time: createdAt })}</span>
            </div>
          </div>
        </article>

        {/* Logout Confirmation Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={handleHideConfirm}>
          <AlertDialogContent data-testid="logout-session-confirm-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('logoutConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.rich('logoutConfirmDescription', {
                  device: deviceLabel,
                  strong: (chunks) => <strong>{chunks}</strong>,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="cancel-logout-button">
                {tCommon('cancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                disabled={isLoading}
                aria-busy={isLoading}
                data-testid="confirm-logout-button"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isLoading && (
                  <Loader2 className="me-2 h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                )}
                {t('logout')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if session data actually changes
    return (
      prevProps.session.id === nextProps.session.id &&
      prevProps.session.lastUsedAt === nextProps.session.lastUsedAt &&
      prevProps.session.isCurrent === nextProps.session.isCurrent
    );
  },
);
