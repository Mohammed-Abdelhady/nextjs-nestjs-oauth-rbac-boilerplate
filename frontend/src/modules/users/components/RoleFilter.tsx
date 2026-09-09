'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchBar } from '@/components/design-system';
import { PaginationControl } from '@/components/pagination';
import { useListRolesQuery } from '@/modules/roles/api/rolesApi';
import { useDebounce } from '@/hooks/useDebounce';

export function RoleFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (role: string) => void;
}) {
  const t = useTranslations('users');
  const rolesText = useTranslations('roles');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useDebounce(search, 300);
  const { currentData, isFetching, isError, refetch } = useListRolesQuery(
    { page, limit: 20, search: query.trim() || undefined },
    { skip: !open },
  );
  const lastPage = Math.max(1, currentData?.totalPages ?? page);
  if (!isFetching && !isError && page > lastPage) setPage(lastPage);

  function choose(role: string) {
    onChange(role);
    setOpen(false);
  }

  function changeSearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-50 justify-between"
          data-testid="role-filter"
        >
          <span className="truncate">
            {value === 'all' ? t('allRoles') : value.charAt(0).toUpperCase() + value.slice(1)}
          </span>
          <ChevronDown className="ms-2 h-4 w-4 shrink-0" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="role-filter-dialog" className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('roleFilterTitle')}</DialogTitle>
          <DialogDescription>{t('roleFilterHint')}</DialogDescription>
        </DialogHeader>
        <SearchBar
          value={search}
          onChange={(event) => changeSearch(event.target.value)}
          onClear={() => changeSearch('')}
          showClear={search.length > 0}
          placeholder={rolesText('searchPlaceholder')}
          aria-label={rolesText('searchPlaceholder')}
          data-testid="role-filter-search"
        />
        <Button
          variant={value === 'all' ? 'secondary' : 'ghost'}
          onClick={() => choose('all')}
          aria-pressed={value === 'all'}
          data-testid="role-filter-all"
        >
          {t('allRoles')}
        </Button>
        <div aria-busy={isFetching}>
          {isFetching && <p role="status">{rolesText('loading')}</p>}
          {isError ? (
            <div role="alert" className="space-y-2">
              <p>{t('roleFilterError')}</p>
              <Button
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="role-filter-retry"
              >
                {common('retry')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-1" data-testid="role-filter-results">
              {currentData?.roles.map((role) => (
                <Button
                  key={role.id}
                  variant={value === role.slug ? 'secondary' : 'ghost'}
                  className="justify-start"
                  disabled={isFetching}
                  aria-pressed={value === role.slug}
                  onClick={() => choose(role.slug)}
                  data-testid={`role-filter-option-${role.slug}`}
                >
                  {role.name}
                </Button>
              ))}
              {!isFetching && currentData?.roles.length === 0 && (
                <p role="status">{rolesText('noRoles')}</p>
              )}
            </div>
          )}
        </div>
        <PaginationControl
          currentPage={page}
          totalPages={lastPage}
          onPageChange={setPage}
          isLoading={isFetching}
        />
      </DialogContent>
    </Dialog>
  );
}
