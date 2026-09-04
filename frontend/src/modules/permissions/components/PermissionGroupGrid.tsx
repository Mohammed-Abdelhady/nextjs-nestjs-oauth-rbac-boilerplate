import { memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { parsePermission } from '../utils/permissionUtils';

interface PermissionGroupGridProps {
  permissions: Record<string, string>;
  selectedPermissions: string[];
  onTogglePermission: (permission: string) => void;
  disabled?: boolean;
  prefix?: string;
}

function formatPermissionLabel(permission: string): string {
  const parsed = parsePermission(permission);
  if (!parsed) return permission;

  const { action, scope } = parsed;
  const actionLabel = action.charAt(0).toUpperCase() + action.slice(1);
  const scopeLabel = scope ? ` (${scope})` : '';

  return `${actionLabel}${scopeLabel}`;
}

export const PermissionGroupGrid = memo(function PermissionGroupGrid({
  permissions,
  selectedPermissions,
  onTogglePermission,
  disabled = false,
  prefix = '',
}: PermissionGroupGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted p-4">
      {Object.entries(permissions).map(([, permission]) => {
        const id = `permission-${permission}${prefix ? `-${prefix}` : ''}`;
        return (
          <div key={permission} className="flex items-start space-x-3">
            <Checkbox
              id={id}
              checked={selectedPermissions.includes(permission)}
              onCheckedChange={() => onTogglePermission(permission)}
              disabled={disabled}
              data-testid={`permission-checkbox-${permission}`}
            />
            <div className="flex-1">
              <Label htmlFor={id} className="cursor-pointer text-sm leading-tight">
                {formatPermissionLabel(permission)}
              </Label>
              <p className="mt-0.5 text-xs text-tertiary font-mono">{permission}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
});
