import { NativeApp } from '@app/native-ui';
import { deviceLocale, hostProps, logicalInsets } from '@app/native-ui/host';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME, DEBUG_BAND_HEIGHT, DEBUG_HOLD_MS, DEBUG_VIEW_AVAILABLE } from './config';
import { DIRECTION, translate } from './i18n/messages';
import { render } from './logic/outcome-text';
import { DebugGate } from './screen/DebugGate';
import { DebugScreen } from './screen/DebugScreen';
import type { StartedShellAuth } from './shell';
import { START, type Start } from './start';

const LOCALE = deviceLocale();

const PADDING = 16;
const styles = StyleSheet.create({
  notice: { padding: PADDING, writingDirection: DIRECTION[LOCALE] },
});

function Notice({ text }: { text: string }) {
  const { top } = useSafeAreaInsets();
  return <Text style={[styles.notice, { marginTop: top }]}>{text}</Text>;
}

function Hosted({ auth }: { auth: StartedShellAuth }) {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(false);
  const openCheck = useCallback(() => setChecking(true), []);
  const closeCheck = useCallback(() => setChecking(false), []);

  if (checking) return <DebugScreen auth={auth} locale={LOCALE} onClose={closeCheck} />;
  return (
    <DebugGate
      available={DEBUG_VIEW_AVAILABLE}
      holdMs={DEBUG_HOLD_MS}
      stripHeight={insets.top + DEBUG_BAND_HEIGHT}
      onOpen={openCheck}
    >
      <NativeApp {...hostProps(auth, APP_NAME, LOCALE)} insets={logicalInsets(insets, LOCALE)} />
    </DebugGate>
  );
}

function Started() {
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

  if (start === undefined) return <Notice text={translate(LOCALE, 'starting')} />;
  if ('failure' in start) {
    return <Notice text={translate(LOCALE, 'startFailed', render(LOCALE, start.failure))} />;
  }
  return <Hosted auth={start.auth} />;
}

export function App() {
  return (
    <SafeAreaProvider>
      <Started />
    </SafeAreaProvider>
  );
}
