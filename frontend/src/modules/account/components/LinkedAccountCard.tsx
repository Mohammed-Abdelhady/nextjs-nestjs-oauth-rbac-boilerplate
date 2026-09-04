'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, Link as LinkIcon, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useUnlinkProviderMutation, useSetPrimaryProviderMutation } from '../api';
import { getOAuthProviderIconPath, formatProviderName, type OAuthProvider } from '@/modules/oauth';
import { parseApiError } from '@/lib/apiError';

interface LinkedAccountCardProps {
  provider: string;
  isPrimary: boolean;
  canUnlink: boolean;
  onLinkSuccess?: () => void;
}

/**
 * LinkedAccountCard Component
 * Displays a linked OAuth provider with options to set as primary or unlink
 */
export function LinkedAccountCard({
  provider,
  isPrimary,
  canUnlink,
  onLinkSuccess,
}: LinkedAccountCardProps) {
  const t = useTranslations('settings.accounts');
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);

  const [unlinkProvider, { isLoading: isUnlinking }] = useUnlinkProviderMutation();
  const [setPrimaryProvider, { isLoading: isSettingPrimary }] = useSetPrimaryProviderMutation();

  const handleUnlink = async () => {
    try {
      await unlinkProvider(provider.toLowerCase() as OAuthProvider).unwrap();
      toast.success(t('unlinkSuccess', { provider: formatProviderName(provider) }));
      onLinkSuccess?.();
      setShowUnlinkDialog(false);
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || t('unlinkError', { provider: formatProviderName(provider) }));
    }
  };

  const handleSetPrimary = async () => {
    try {
      await setPrimaryProvider({
        provider: provider.toLowerCase() as OAuthProvider,
      }).unwrap();
      toast.success(t('setPrimarySuccess', { provider: formatProviderName(provider) }));
      onLinkSuccess?.();
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(
        parsed.message || t('setPrimaryError', { provider: formatProviderName(provider) }),
      );
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d={getOAuthProviderIconPath(provider.toLowerCase())} />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{formatProviderName(provider)}</h3>
                  {isPrimary && (
                    <Badge variant="default" className="text-xs">
                      <CheckCircle2 className="me-1 h-3 w-3" />
                      {t('primary')}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isPrimary ? t('primaryDescription') : t('linkedDescription')}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:shrink-0">
              {!isPrimary && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetPrimary}
                  disabled={isSettingPrimary || isUnlinking}
                  className="w-full whitespace-nowrap lg:w-auto"
                >
                  {isSettingPrimary ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4 shrink-0" />
                      <span>{t('setPrimary')}</span>
                    </>
                  )}
                </Button>
              )}

              {canUnlink && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowUnlinkDialog(true)}
                  disabled={isUnlinking || isSettingPrimary}
                  className="w-full whitespace-nowrap lg:w-auto"
                >
                  {isUnlinking ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 shrink-0" />
                      <span>{t('unlink')}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('unlinkConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('unlinkConfirmDescription', {
                provider: formatProviderName(provider),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('confirmUnlink')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
