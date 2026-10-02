import { useTranslations } from 'next-intl';
import { Globe, TabletSmartphone, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SESSION_KIND, type SessionKind } from '../constants';

interface SessionKindBadgeProps {
  readonly kind: SessionKind;
  /** Lets the row point its accessible name at the label. */
  readonly id?: string;
}

const iconMap: Record<SessionKind, LucideIcon> = {
  [SESSION_KIND.BROWSER]: Globe,
  [SESSION_KIND.NATIVE_APP]: TabletSmartphone,
};

/**
 * SessionKindBadge says whether a session is a browser or the mobile app.
 * Both kinds share one variant, so the words carry the difference.
 */
export function SessionKindBadge({ kind, id }: SessionKindBadgeProps) {
  const t = useTranslations('sessions');
  const Icon = iconMap[kind];

  return (
    <Badge
      id={id}
      variant="outline"
      className="gap-1 text-card-foreground"
      data-testid={`session-kind-${kind}`}
    >
      <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      {t(`kind.${kind}`)}
    </Badge>
  );
}
