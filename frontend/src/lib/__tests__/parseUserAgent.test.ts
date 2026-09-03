import { describe, expect, it } from 'vitest';
import { parseUserAgent, getDeviceLabel, getDeviceIconName } from '../parseUserAgent';

describe('parseUserAgent', () => {
  describe('Desktop browsers', () => {
    it('should parse Chrome on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('Chrome 120');
      expect(result.os).toBe('Windows 10/11');
    });

    it('should parse Firefox on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('Firefox 120');
      expect(result.os).toContain('macOS');
    });

    it('should parse Safari on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('Safari 17');
      expect(result.os).toContain('macOS');
    });

    it('should parse Edge on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('Edge 120');
      expect(result.os).toBe('Windows 10/11');
    });

    it('should parse Opera on Linux', () => {
      const ua =
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('Opera 106');
      expect(result.os).toBe('Linux');
    });
  });

  describe('Mobile browsers', () => {
    it('should parse Chrome on Android', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Mobile');
      expect(result.browser).toBe('Chrome 120');
      expect(result.os).toBe('Android 13');
    });

    it('should parse Safari on iPhone', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Mobile');
      expect(result.browser).toBe('Safari 17');
      expect(result.os).toBe('iOS 17');
    });

    it('should parse Samsung Browser on Android', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Mobile');
      expect(result.browser).toBe('Samsung 23');
      expect(result.os).toBe('Android 13');
    });
  });

  describe('Tablet browsers', () => {
    it('should parse Safari on iPad', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Tablet');
      expect(result.browser).toBe('Safari 17');
      expect(result.os).toBe('iPadOS 17');
    });

    it('should parse Chrome on Android Tablet', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Tablet');
      expect(result.browser).toBe('Chrome 120');
      expect(result.os).toBe('Android 13');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty user agent', () => {
      const result = parseUserAgent('');

      expect(result.device).toBe('Unknown');
      expect(result.browser).toBe('Unknown');
      expect(result.os).toBe('Unknown');
    });

    it('should handle invalid user agent', () => {
      const result = parseUserAgent(null as unknown as string);

      expect(result.device).toBe('Unknown');
      expect(result.browser).toBe('Unknown');
      expect(result.os).toBe('Unknown');
    });

    it('should handle unknown user agent', () => {
      const result = parseUserAgent('CustomBot/1.0');

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('Unknown Browser');
      expect(result.os).toBe('Unknown OS');
    });

    it('should handle IE user agent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko';
      const result = parseUserAgent(ua);

      expect(result.device).toBe('Desktop');
      expect(result.browser).toBe('IE 11');
      expect(result.os).toBe('Windows 10/11');
    });
  });
});

describe('getDeviceLabel', () => {
  it('should return formatted device label for Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const label = getDeviceLabel(ua);

    expect(label).toBe('Chrome 120 on Windows 10/11');
  });

  it('should return formatted device label for Safari on iPhone', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const label = getDeviceLabel(ua);

    expect(label).toBe('Safari 17 on iOS 17');
  });

  it('should handle unknown user agents', () => {
    const label = getDeviceLabel('');

    expect(label).toBe('Unknown on Unknown');
  });
});

describe('getDeviceIconName', () => {
  it('should return "smartphone" for mobile devices', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const icon = getDeviceIconName(ua);

    expect(icon).toBe('smartphone');
  });

  it('should return "tablet" for tablet devices', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const icon = getDeviceIconName(ua);

    expect(icon).toBe('tablet');
  });

  it('should return "monitor" for desktop devices', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const icon = getDeviceIconName(ua);

    expect(icon).toBe('monitor');
  });

  it('should return "help-circle" for unknown devices', () => {
    const icon = getDeviceIconName('');

    expect(icon).toBe('help-circle');
  });
});
