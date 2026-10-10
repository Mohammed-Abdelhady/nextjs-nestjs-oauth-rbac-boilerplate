import { NativeApp } from '@app/native-ui';
import { deviceLocale, hostProps, logicalInsets } from '@app/native-ui/host';
import { useEffect, useState } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME } from './config';
import type { StartedShellAuth } from './shell';
import { START, type Start } from './start';

const LOCALE = deviceLocale();

function Hosted({ auth }: { auth: StartedShellAuth }) {
  const insets = useSafeAreaInsets();
  return (
    <NativeApp {...hostProps(auth, APP_NAME, LOCALE)} insets={logicalInsets(insets, LOCALE)} />
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

  // The launch screen's background shows for the moment the key takes to answer.
  if (start === undefined) return null;
  // Only a build without the key module linked gets here. It must not run unbound in silence.
  if ('failure' in start) throw start.failure;
  return <Hosted auth={start.auth} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Started />
    </SafeAreaProvider>
  );
}
