'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGetEnabledProvidersQuery, getProviderDisplayName } from '@/modules/oauth';
import { useGetLinkedProvidersQuery } from '../api';
import { LinkedAccountCard } from './LinkedAccountCard';
import { LinkProviderButton } from './LinkProviderButton';

/**
 * LinkedAccounts Component
 * Lists the sign-in methods on the account and the providers still available
 */
export function LinkedAccounts() {
  const t = useTranslations('settings.accounts');

  const {
    data: linkedProvidersData,
    isLoading: isLoadingLinked,
    refetch,
  } = useGetLinkedProvidersQuery();

  const { data: enabledProviders = [], isLoading: isLoadingEnabled } =
    useGetEnabledProvidersQuery();

  const linkedProviders = linkedProvidersData?.providers || [];
  const primaryProvider = linkedProvidersData?.primaryProvider;

  const availableProviders = enabledProviders.filter(
    (provider) => !linkedProviders.includes(provider.id),
  );

  const canUnlink = linkedProviders.length > 1;

  if (isLoadingLinked || isLoadingEnabled) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {linkedProviders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('linkedAccountsLabel')}</h3>
            <div className="space-y-3">
              {linkedProviders.map((providerId) => (
                <LinkedAccountCard
                  key={providerId}
                  providerId={providerId}
                  displayName={getProviderDisplayName(providerId, enabledProviders)}
                  isPrimary={providerId === primaryProvider}
                  canUnlink={canUnlink}
                  onChange={refetch}
                />
              ))}
            </div>
          </div>
        )}

        {!canUnlink && linkedProviders.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('cannotUnlinkWarning')}</AlertDescription>
          </Alert>
        )}

        {availableProviders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">{t('availableProvidersLabel')}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {availableProviders.map((provider) => (
                <LinkProviderButton key={provider.id} provider={provider} />
              ))}
            </div>
          </div>
        )}

        {availableProviders.length === 0 && linkedProviders.length > 0 && (
          <Alert>
            <AlertDescription>{t('allProvidersLinked')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
