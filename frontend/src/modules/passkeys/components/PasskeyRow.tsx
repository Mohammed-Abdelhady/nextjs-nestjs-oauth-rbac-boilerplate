'use client';

import { useLocale, useTranslations } from 'next-intl';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateLong } from '@/lib/formatters';
import { PASSKEY_DEVICE_TYPE, type PasskeyDeviceType } from '../constants';
import type { PasskeySummary } from '../types';

interface PasskeyRowProps {
  passkey: PasskeySummary;
  onRename: (passkey: PasskeySummary) => void;
  onDelete: (passkey: PasskeySummary) => void;
}

/** Only the two types the badge has words for; anything else stays unlabelled. */
function deviceTypeOf(deviceType: string | undefined): PasskeyDeviceType | null {
  return Object.values(PASSKEY_DEVICE_TYPE).find((known) => known === deviceType) ?? null;
}

/** One passkey in the settings list, with what it is and when it last worked. */
export function PasskeyRow({ passkey, onRename, onDelete }: PasskeyRowProps) {
  const t = useTranslations('settings.passkeys');
  const locale = useLocale();
  const deviceType = deviceTypeOf(passkey.deviceType);

  return (
    <li
      className="flex items-start justify-between gap-3 rounded-md border p-3"
      data-testid={`passkey-row-${passkey.id}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate font-medium" data-testid={`passkey-name-${passkey.id}`}>
            {passkey.name}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {deviceType && (
            <Badge variant="secondary" data-testid={`passkey-device-type-${passkey.id}`}>
              {t(`deviceType.${deviceType}`)}
            </Badge>
          )}
          {passkey.backedUp && (
            <Badge variant="success" data-testid={`passkey-backed-up-${passkey.id}`}>
              {t('backedUp')}
            </Badge>
          )}
        </div>

        <p className="mt-1.5 text-xs text-muted-foreground">
          {t('added', { date: formatDateLong(passkey.createdAt, locale) })}
        </p>
        <p className="text-xs text-muted-foreground">
          {passkey.lastUsedAt === null
            ? t('neverUsed')
            : t('lastUsed', { date: formatDateLong(passkey.lastUsedAt, locale) })}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onRename(passkey)}
          aria-label={t('rename.label', { name: passkey.name })}
          data-testid={`passkey-rename-${passkey.id}`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onDelete(passkey)}
          aria-label={t('delete.label', { name: passkey.name })}
          data-testid={`passkey-delete-${passkey.id}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}
