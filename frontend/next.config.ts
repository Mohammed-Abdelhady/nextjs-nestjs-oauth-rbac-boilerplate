import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { buildSecurityHeaders } from './src/lib/config/security-headers';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Keep next dev from writing frontend instruction files into generated projects.
  agentRules: false,
  output: 'standalone',
  transpilePackages: ['@app/core', '@app/sdk'],
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
