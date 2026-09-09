import { UpdateProfileCard } from '@/modules/account';
import { LinkedAccounts, ProfileSyncStatus } from '@/modules/account'; // feature:oauth-core
import { ChangePasswordCard } from '@/modules/auth/methods/password'; // feature:email-password
import { PasskeysCard } from '@/modules/passkeys'; // feature:passkeys
import { TwoFactorCard } from '@/modules/two-factor'; // feature:totp
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Generate metadata for the settings page
 */
export async function generateMetadata({ params }: SettingsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

/**
 * Settings Page
 *
 * Groups the account cards under headings so the card titles (h3) follow an h2
 * instead of jumping straight from the page h1.
 */
export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'settings' });

  return (
    <div className="container p-10">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        <section aria-labelledby="settings-account-group" className="space-y-4">
          <h2
            id="settings-account-group"
            className="text-xs uppercase tracking-widest text-muted-foreground"
          >
            {t('accountGroup')}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <UpdateProfileCard />
            <ChangePasswordCard /> {/* feature:email-password */}
            {/* feature:totp:start */}
            <TwoFactorCard />
            {/* feature:totp:end */}
            {/* feature:passkeys:start */}
            <PasskeysCard />
            {/* feature:passkeys:end */}
          </div>
        </section>

        {/* feature:oauth-core:start */}
        <section aria-labelledby="settings-integrations-group" className="space-y-4">
          <h2
            id="settings-integrations-group"
            className="text-xs uppercase tracking-widest text-muted-foreground"
          >
            {t('integrationsGroup')}
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <LinkedAccounts />
            <ProfileSyncStatus />
          </div>
        </section>
        {/* feature:oauth-core:end */}
      </div>
    </div>
  );
}
