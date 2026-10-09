import { NativeApp } from '@app/native-ui';
import { deviceLocale, hostProps, logicalInsets } from '@app/native-ui/host';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_NAME } from './config';
import { AUTH } from './start';

const LOCALE = deviceLocale();
const HOST_PROPS = hostProps(AUTH, APP_NAME, LOCALE);

function Hosted() {
  const insets = useSafeAreaInsets();
  return <NativeApp {...HOST_PROPS} insets={logicalInsets(insets, LOCALE)} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Hosted />
    </SafeAreaProvider>
  );
}
