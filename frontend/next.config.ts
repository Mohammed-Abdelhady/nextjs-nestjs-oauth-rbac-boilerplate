import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { buildSecurityHeaders } from './src/lib/config/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
