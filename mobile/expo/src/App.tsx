import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AUTH_CONFIGURATION, DEVICE_KEY_PROTECTION, EPHEMERAL_BROWSER_SESSION } from './config';
import { createNativeShellAuth } from './engine';
import { DIRECTION, resolveLocale, translate } from './i18n/messages';
import { describeError, render, type Described } from './logic/outcome-text';
import { DebugScreen } from './screen/DebugScreen';
import type { StartedShellAuth } from './shell';

function deviceLocaleTag(): string | undefined {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

type Start = { auth: StartedShellAuth } | { failure: Described };

/** Started once per process: the key is prepared before the engine exists. */
const START: Promise<Start> = Promise.resolve()
  .then(() =>
    createNativeShellAuth(AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION, DEVICE_KEY_PROTECTION),
  )
  .then(
    (auth) => ({ auth }),
    (error: unknown) => ({ failure: describeError(error) }),
  );
const LOCALE = resolveLocale(deviceLocaleTag());

const PADDING = 16;
const TOP_INSET = 64;
const styles = StyleSheet.create({
  notice: { padding: PADDING, paddingTop: TOP_INSET, writingDirection: DIRECTION[LOCALE] },
});

export function App() {
  const [start, setStart] = useState<Start>();

  useEffect(() => {
    let mounted = true;
    void START.then((started) => {
      if (mounted) setStart(started);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (start === undefined)
    return <Text style={styles.notice}>{translate(LOCALE, 'starting')}</Text>;
  if ('failure' in start) {
    return (
      <Text style={styles.notice}>
        {translate(LOCALE, 'startFailed', render(LOCALE, start.failure))}
      </Text>
    );
  }
  return <DebugScreen auth={start.auth} locale={LOCALE} />;
}
