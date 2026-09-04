'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut, Loader2 } from 'lucide-react';
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
import { useRevokeAllOtherSessionsMutation } from '../api/sessionsApi';
import { useToast } from '@/hooks/use-toast';

export interface RevokeAllSessionsButtonProps {
  /** Number of other sessions that will be revoked */
  otherSessionsCount: number;
  /** Optional callback when sessions are revoked successfully */
  onSuccess?: (revokedCount: number) => void;
  /** Additional className for the button */
  className?: string;
}

/**
 * RevokeAllSessionsButton - Button with co-located confirmation dialog.
 *
 * Implements the co-location pattern where the button manages its own
 * dialog state internally.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <RevokeAllSessionsButton otherSessionsCount={3} />
 *
 * // With success callback
 * <RevokeAllSessionsButton
 *   otherSessionsCount={3}
 *   onSuccess={(count) => console.log(`Revoked ${count} sessions`)}
 * />
 * ```
 */
export function RevokeAllSessionsButton({
  otherSessionsCount,
  onSuccess,
  className,
}: RevokeAllSessionsButtonProps) {
  const [open, setOpen] = useState(false);
  const [revokeAllOtherSessions, { isLoading }] = useRevokeAllOtherSessionsMutation();
  const { toast } = useToast();
  const t = useTranslations('sessions');
  const tCommon = useTranslations('common');

  const handleRevoke = async () => {
    try {
      const result = await revokeAllOtherSessions().unwrap();
      toast.success(t('logoutAllSuccess', { count: result.revokedCount }));
      setOpen(false);
      onSuccess?.(result.revokedCount);
    } catch {
      toast.error(t('logoutAllError'));
    }
  };

  // Don't render if there are no other sessions
  if (otherSessionsCount === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isLoading}
        className={className}
        data-testid="logout-all-sessions-button"
      >
        <LogOut className="h-4 w-4 me-2" />
        {t('logoutAllOther')}
      </Button>

      {/* Co-located confirmation dialog */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent data-testid="revoke-all-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('logoutAllConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('logoutAllConfirmDescription', { count: otherSessionsCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-logout-all">
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isLoading}
              data-testid="confirm-logout-all"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('loggingOut')}
                </>
              ) : (
                t('logoutAll')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default RevokeAllSessionsButton;
