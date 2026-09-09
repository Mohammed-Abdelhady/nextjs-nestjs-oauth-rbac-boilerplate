import { parseUserAgent, getDeviceLabel } from './parse-user-agent';

describe('parseUserAgent', () => {
  it('handles empty or missing user agent strings', () => {
    const emptyResult = parseUserAgent('');
    expect(emptyResult).toEqual({
      type: 'unknown',
      browser: 'Unknown Browser',
      os: 'Unknown OS',
      name: 'Unknown device',
    });

    const label = getDeviceLabel('');
    expect(label).toBe('Unknown device');
  });

  it('detects macOS Chrome desktop', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('desktop');
    expect(result.browser).toBe('Chrome 120');
    expect(result.os).toBe('macOS 10.15');
    expect(result.name).toBe('Chrome 120 on macOS 10.15');
  });

  it('detects Windows Firefox desktop', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('desktop');
    expect(result.browser).toBe('Firefox 121');
    expect(result.os).toBe('Windows 10/11');
    expect(result.name).toBe('Firefox 121 on Windows 10/11');
  });

  it('detects Windows Edge desktop', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('desktop');
    expect(result.browser).toBe('Edge 120');
    expect(result.os).toBe('Windows 10/11');
  });

  it('detects iPhone Safari mobile', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('mobile');
    expect(result.browser).toBe('Safari 17');
    expect(result.os).toBe('iOS 17');
    expect(result.name).toBe('Safari 17 on iOS 17');
  });

  it('detects iPadOS tablet', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('tablet');
    expect(result.browser).toBe('Safari 16');
    expect(result.os).toBe('iPadOS 16');
  });

  it('detects Android Chrome mobile', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('mobile');
    expect(result.browser).toBe('Chrome 120');
    expect(result.os).toBe('Android 14');
  });

  it('detects Android tablet', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('tablet');
    expect(result.browser).toBe('Chrome 120');
    expect(result.os).toBe('Android 13');
  });

  it('detects Ubuntu Linux desktop', () => {
    const ua =
      'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0';
    const result = parseUserAgent(ua);
    expect(result.type).toBe('desktop');
    expect(result.browser).toBe('Firefox 119');
    expect(result.os).toBe('Ubuntu');
  });

  it('detects Opera browser', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 OPR/105.0.0.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Opera 105');
  });

  it('detects Samsung browser', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.5790.166 Mobile Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Samsung 23');
  });
});
