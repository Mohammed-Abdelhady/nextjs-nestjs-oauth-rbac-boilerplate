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
import { OAuthProviderIcon } from '@/modules/oauth';
import { parseApiError } from '@/lib/apiError';
import { useUnlinkProviderMutation, useSetPrimaryProviderMutation } from '../api';

interface LinkedAccountCardProps {
  providerId: string;
  displayName: string;
  isPrimary: boolean;
  canUnlink: boolean;
  onChange?: () => void;
}

/**
 * LinkedAccountCard Component
 * One sign-in method with the actions to make it primary or unlink it
 */
export function LinkedAccountCard({
  providerId,
  displayName,
  isPrimary,
  canUnlink,
  onChange,
}: LinkedAccountCardProps) {
  const t = useTranslations('settings.accounts');
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);

  const [unlinkProvider, { isLoading: isUnlinking }] = useUnlinkProviderMutation();
  const [setPrimaryProvider, { isLoading: isSettingPrimary }] = useSetPrimaryProviderMutation();

  const handleUnlink = async () => {
    try {
      await unlinkProvider(providerId).unwrap();
      toast.success(t('unlinkSuccess', { provider: displayName }));
      onChange?.();
      setShowUnlinkDialog(false);
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || t('unlinkError', { provider: displayName }));
    }
  };

  const handleSetPrimary = async () => {
    try {
      await setPrimaryProvider({ provider: providerId }).unwrap();
      toast.success(t('setPrimarySuccess', { provider: displayName }));
      onChange?.();
    } catch (error: unknown) {
      const parsed = parseApiError(error);
      toast.error(parsed.message || t('setPrimaryError', { provider: displayName }));
    }
  };

  return (
    <>
      <Card className="overflow-hidden" data-testid={`linked-account-${providerId}`}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <OAuthProviderIcon
                  providerId={providerId}
                  displayName={displayName}
                  className="h-5 w-5"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{displayName}</h3>
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
                  data-testid={`set-primary-${providerId}`}
                >
                  {isSettingPrimary ? (
                    <Loader2
                      className="h-4 w-4 shrink-0 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
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
                  data-testid={`unlink-${providerId}`}
                >
                  {isUnlinking ? (
                    <Loader2
                      className="h-4 w-4 shrink-0 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
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
              {t('unlinkConfirmDescription', { provider: displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`unlink-cancel-${providerId}`}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`unlink-confirm-${providerId}`}
            >
              {t('confirmUnlink')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
