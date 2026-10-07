import { AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION } from './config';
import { createNativeShellAuth } from './engine';
import { resolveLocale } from './i18n/messages';
import { DebugScreen } from './screen/DebugScreen';

function deviceLocaleTag(): string | undefined {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

const AUTH = createNativeShellAuth(AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION);
const LOCALE = resolveLocale(deviceLocaleTag());

export function App() {
  return <DebugScreen auth={AUTH} locale={LOCALE} />;
}
