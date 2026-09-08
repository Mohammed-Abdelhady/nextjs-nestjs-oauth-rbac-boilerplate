import { describe, expect, it } from 'vitest';
import { DEVICE_LABEL_KEY } from '../../constants';
import { deviceLabelKey } from '../deviceLabel';

const AGENTS = {
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0',
} as const;

describe('deviceLabelKey', () => {
  it('names the desktop families', () => {
    expect(deviceLabelKey(AGENTS.mac)).toBe(DEVICE_LABEL_KEY.MAC);
    expect(deviceLabelKey(AGENTS.windows)).toBe(DEVICE_LABEL_KEY.WINDOWS);
    expect(deviceLabelKey(AGENTS.linux)).toBe(DEVICE_LABEL_KEY.LINUX);
  });

  it('names the phones and tablets', () => {
    expect(deviceLabelKey(AGENTS.iphone)).toBe(DEVICE_LABEL_KEY.IPHONE);
    expect(deviceLabelKey(AGENTS.android)).toBe(DEVICE_LABEL_KEY.ANDROID);
  });

  it('reads a touch capable Mac agent as an iPad', () => {
    expect(deviceLabelKey(AGENTS.ipad)).toBe(DEVICE_LABEL_KEY.IPAD);
  });

  it('falls back for an agent it cannot place', () => {
    expect(deviceLabelKey('')).toBe(DEVICE_LABEL_KEY.OTHER);
    expect(deviceLabelKey('curl/8.7.1')).toBe(DEVICE_LABEL_KEY.OTHER);
  });
});
