export const LOCALE = { EN: 'en', AR: 'ar' } as const;
export type Locale = (typeof LOCALE)[keyof typeof LOCALE];
export type Direction = 'ltr' | 'rtl';

export const DIRECTION: Record<Locale, Direction> = { en: 'ltr', ar: 'rtl' };

const EN = {
  title: 'Sign-in check',
  status: 'Status: {value}',
  operation: 'Operation: {value}',
  reason: 'Reason: {value}',
  account: 'Account: {value}',
  storageWarning: 'Warning: the session is held in memory only',
  lastOutcome: 'Last outcome: {value}',
  refreshRequests: 'Refresh requests sent: {value}',
  none: 'none',
  signIn: 'Sign in',
  signInLabel: 'Sign in through the system browser',
  refresh: 'Refresh the session',
  refreshLabel: 'Refresh the session: force a new access token, then load the profile',
  loadProfile: 'Load the profile',
  loadProfileLabel: 'Load the profile from the server',
  signOut: 'Sign out',
  signOutLabel: 'Sign out and end the session on the server',
};

export type MessageKey = keyof typeof EN;

const AR: Record<MessageKey, string> = {
  title: 'فحص تسجيل الدخول',
  status: 'الحالة: {value}',
  operation: 'العملية: {value}',
  reason: 'السبب: {value}',
  account: 'الحساب: {value}',
  storageWarning: 'تحذير: الجلسة محفوظة في الذاكرة فقط',
  lastOutcome: 'آخر نتيجة: {value}',
  refreshRequests: 'طلبات التجديد المرسلة: {value}',
  none: 'لا يوجد',
  signIn: 'تسجيل الدخول',
  signInLabel: 'تسجيل الدخول عبر متصفح النظام',
  refresh: 'تجديد الجلسة',
  refreshLabel: 'تجديد الجلسة: فرض رمز وصول جديد ثم تحميل الملف الشخصي',
  loadProfile: 'تحميل الملف الشخصي',
  loadProfileLabel: 'تحميل الملف الشخصي من الخادم',
  signOut: 'تسجيل الخروج',
  signOutLabel: 'تسجيل الخروج وإنهاء الجلسة على الخادم',
};

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en: EN, ar: AR };

const VALUE_PLACEHOLDER = '{value}';

/** Any Arabic locale tag, such as `ar-SA` or `ar_EG`, reads Arabic. Others read English. */
export function resolveLocale(tag: string | undefined): Locale {
  return /^ar(?:[-_]|$)/i.test(tag ?? '') ? LOCALE.AR : LOCALE.EN;
}

export function translate(locale: Locale, key: MessageKey, value?: string): string {
  const template = MESSAGES[locale][key];
  return value === undefined ? template : template.replace(VALUE_PLACEHOLDER, () => value);
}
