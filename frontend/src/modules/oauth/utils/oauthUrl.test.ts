import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@/constants/api';
import { buildOAuthStartUrl } from './oauthUrl';

describe('buildOAuthStartUrl', () => {
  it('starts a login without an intent query', () => {
    expect(buildOAuthStartUrl('google', '/dashboard')).toBe(
      `${API_BASE_URL}/api/auth/oauth/google/start?redirect=%2Fdashboard`,
    );
  });

  it('marks a linking start so the backend can bind the session', () => {
    expect(buildOAuthStartUrl('google', '/settings', 'link')).toBe(
      `${API_BASE_URL}/api/auth/oauth/google/start?redirect=%2Fsettings&intent=link`,
    );
  });
});
