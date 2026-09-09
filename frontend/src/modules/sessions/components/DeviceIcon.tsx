import { Monitor, Smartphone, Tablet, HelpCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';

export type DeviceIconSize = 'sm' | 'md' | 'lg';

interface DeviceIconProps {
  readonly deviceType: DeviceType;
  readonly size?: DeviceIconSize;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

const sizeMap: Record<DeviceIconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

const iconMap: Record<DeviceType, LucideIcon> = {
  Desktop: Monitor,
  Mobile: Smartphone,
  Tablet: Tablet,
  Unknown: HelpCircle,
};

/**
 * DeviceIcon component displays an icon based on device type.
 * The device name is written next to it, so the icon is decorative unless the
 * caller passes a label of its own.
 */
export function DeviceIcon({
  deviceType,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: DeviceIconProps) {
  const Icon = iconMap[deviceType];
  const iconSize = sizeMap[size];

  return (
    <Icon
      size={iconSize}
      className={cn('text-muted-foreground', className)}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      data-testid={`device-icon-${deviceType.toLowerCase()}`}
    />
  );
}
