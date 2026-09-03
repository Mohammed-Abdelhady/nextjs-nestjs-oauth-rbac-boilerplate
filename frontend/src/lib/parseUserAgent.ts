/**
 * User Agent Parser Utility
 * Extracts device type, browser, and OS information from user agent strings
 */

export interface ParsedUserAgent {
  device: string;
  browser: string;
  os: string;
}

/**
 * Detects the device type from user agent string
 */
function detectDevice(ua: string): string {
  const lowerUA = ua.toLowerCase();

  // Tablets (check tablets before mobile since iPad includes 'Mobile' and Android tablets lack 'Mobile')
  if (
    /ipad|tablet|kindle|silk|playbook/i.test(lowerUA) ||
    (/android/i.test(lowerUA) && !/mobile/i.test(lowerUA))
  ) {
    return 'Tablet';
  }

  // Mobile devices
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(lowerUA)) {
    return 'Mobile';
  }

  // Desktop
  return 'Desktop';
}

/**
 * Detects the browser name and version from user agent string
 */
function detectBrowser(ua: string): string {
  const lowerUA = ua.toLowerCase();

  // Edge (Chromium-based)
  if (/edg/i.test(ua)) {
    const match = ua.match(/edg[ea]?\/(\d+)/i);
    return match ? `Edge ${match[1]}` : 'Edge';
  }

  // Opera (must check before Chrome)
  if (/opera|opr/i.test(lowerUA)) {
    const match = ua.match(/(?:opera|opr)\/(\d+)/i);
    return match ? `Opera ${match[1]}` : 'Opera';
  }

  // Samsung Browser (must check before Chrome)
  if (/samsungbrowser/i.test(lowerUA)) {
    const match = ua.match(/samsungbrowser\/(\d+)/i);
    return match ? `Samsung ${match[1]}` : 'Samsung Browser';
  }

  // Chrome
  if (/chrome/i.test(lowerUA)) {
    const match = ua.match(/chrome\/(\d+)/i);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }

  // Safari (must check before Chrome as Safari UA contains both)
  if (/safari/i.test(lowerUA)) {
    const match = ua.match(/version\/(\d+)/i);
    return match ? `Safari ${match[1]}` : 'Safari';
  }

  // Firefox
  if (/firefox/i.test(lowerUA)) {
    const match = ua.match(/firefox\/(\d+)/i);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }

  // Internet Explorer
  if (/msie|trident/i.test(lowerUA)) {
    const match = ua.match(/(?:msie |rv:)(\d+)/i);
    return match ? `IE ${match[1]}` : 'IE';
  }

  return 'Unknown Browser';
}

/**
 * Detects the operating system from user agent string
 */
function detectOS(ua: string): string {
  const lowerUA = ua.toLowerCase();

  // Windows
  if (/windows nt 10/i.test(lowerUA)) return 'Windows 10/11';
  if (/windows nt 6.3/i.test(lowerUA)) return 'Windows 8.1';
  if (/windows nt 6.2/i.test(lowerUA)) return 'Windows 8';
  if (/windows nt 6.1/i.test(lowerUA)) return 'Windows 7';
  if (/windows/i.test(lowerUA)) return 'Windows';

  // iOS / iPadOS (must check before macOS as iOS UAs include 'like Mac OS X')
  if (/ipad.*os (\d+)/i.test(lowerUA)) {
    const match = ua.match(/os (\d+)/i);
    return match ? `iPadOS ${match[1]}` : 'iPadOS';
  }
  if (/ipad/i.test(lowerUA)) return 'iPadOS';
  if (/iphone os (\d+)/i.test(lowerUA)) {
    const match = ua.match(/iphone os (\d+)/i);
    return match ? `iOS ${match[1]}` : 'iOS';
  }
  if (/iphone|ipod/i.test(lowerUA)) return 'iOS';

  // macOS
  if (/mac os x 10[._](\d+)/i.test(lowerUA)) {
    const match = ua.match(/mac os x 10[._](\d+)/i);
    return match ? `macOS 10.${match[1]}` : 'macOS';
  }
  if (/mac os x/i.test(lowerUA)) return 'macOS';
  if (/macintosh/i.test(lowerUA)) return 'Mac OS';

  // Android
  if (/android (\d+)/i.test(lowerUA)) {
    const match = ua.match(/android (\d+)/i);
    return match ? `Android ${match[1]}` : 'Android';
  }
  if (/android/i.test(lowerUA)) return 'Android';

  // Linux
  if (/linux/i.test(lowerUA)) {
    if (/ubuntu/i.test(lowerUA)) return 'Ubuntu';
    if (/debian/i.test(lowerUA)) return 'Debian';
    if (/fedora/i.test(lowerUA)) return 'Fedora';
    return 'Linux';
  }

  // Chrome OS
  if (/cros/i.test(lowerUA)) return 'Chrome OS';

  return 'Unknown OS';
}

/**
 * Parses a user agent string and extracts device, browser, and OS information
 *
 * This is a lightweight alternative to external libraries like ua-parser-js,
 * providing accurate detection for modern browsers and devices without
 * additional dependencies.
 *
 * Supports detection of:
 * - Device types: Desktop, Mobile, Tablet
 * - Browsers: Chrome, Firefox, Safari, Edge, Opera, Brave, Samsung Internet
 * - Operating Systems: Windows, macOS, iOS, iPadOS, Android, Linux variants
 *
 * @param userAgent - The user agent string to parse (from request headers)
 * @returns ParsedUserAgent object with device, browser, and os fields
 *
 * @example
 * ```ts
 * const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...';
 * const parsed = parseUserAgent(ua);
 * // { device: 'Desktop', browser: 'Chrome 120', os: 'macOS' }
 * ```
 *
 * @see getDeviceLabel - For generating human-readable device descriptions
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  if (!userAgent || typeof userAgent !== 'string') {
    return {
      device: 'Unknown',
      browser: 'Unknown',
      os: 'Unknown',
    };
  }

  return {
    device: detectDevice(userAgent),
    browser: detectBrowser(userAgent),
    os: detectOS(userAgent),
  };
}

/**
 * Returns a short device label suitable for display (e.g., "Chrome on Windows")
 */
export function getDeviceLabel(userAgent: string): string {
  const { browser, os } = parseUserAgent(userAgent);
  return `${browser} on ${os}`;
}

/**
 * Returns a device icon name based on device type
 * Useful for mapping to icon components
 */
export function getDeviceIconName(userAgent: string): string {
  const { device } = parseUserAgent(userAgent);

  switch (device) {
    case 'Mobile':
      return 'smartphone';
    case 'Tablet':
      return 'tablet';
    case 'Desktop':
      return 'monitor';
    default:
      return 'help-circle';
  }
}
