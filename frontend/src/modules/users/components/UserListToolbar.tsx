'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchBar } from '@/components/design-system';

export interface UserListToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  roles: string[];
}

export function UserListToolbar({
  searchQuery,
  onSearchChange,
  onSearchClear,
  roleFilter,
  onRoleFilterChange,
  roles,
}: UserListToolbarProps) {
  const t = useTranslations('users');

  return (
    <div className="mb-8 flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <SearchBar
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={onSearchClear}
          showClear={searchQuery.length > 0}
          data-testid="search-users-input"
        />
      </div>
      <Select value={roleFilter} onValueChange={onRoleFilterChange}>
        <SelectTrigger className="w-full sm:w-50" data-testid="role-filter">
          <SelectValue placeholder={t('allRoles')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allRoles')}</SelectItem>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
