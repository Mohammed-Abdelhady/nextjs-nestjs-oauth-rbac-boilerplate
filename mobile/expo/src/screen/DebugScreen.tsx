import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ShellAuth } from '../shell';
import { DIRECTION, translate, type Locale, type MessageKey } from '../i18n/messages';
import { useAuthDebug } from './use-auth-debug';

export const TEST_ID = {
  STATUS: 'auth-status',
  OPERATION: 'auth-operation',
  LAST_OUTCOME: 'auth-last-outcome',
  REFRESH_REQUESTS: 'auth-refresh-requests',
  SIGN_IN: 'auth-sign-in',
  REFRESH: 'auth-refresh',
  LOAD_PROFILE: 'auth-load-profile',
  SIGN_OUT: 'auth-sign-out',
} as const;

const SPACING = 16;
const TOP_INSET = 64;

const styles = StyleSheet.create({
  content: { gap: SPACING, padding: SPACING, paddingTop: TOP_INSET },
});

interface DebugScreenProps {
  auth: ShellAuth;
  locale: Locale;
}

export function DebugScreen({ auth, locale }: DebugScreenProps) {
  const { snapshot, lastOutcome, refreshRequests, signIn, refresh, loadProfile, signOut } =
    useAuthDebug(auth);
  const direction = DIRECTION[locale];
  const text = (key: MessageKey, value?: string): string => translate(locale, key, value);
  const none = text('none');
  const line = { writingDirection: direction } as const;

  return (
    <ScrollView contentContainerStyle={[styles.content, { direction }]}>
      <Text accessibilityRole="header" style={line}>
        {text('title')}
      </Text>
      <View>
        <Text testID={TEST_ID.STATUS} style={line}>
          {text('status', snapshot.status)}
        </Text>
        <Text testID={TEST_ID.OPERATION} style={line}>
          {text('operation', snapshot.operation)}
        </Text>
        <Text style={line}>{text('reason', snapshot.reason ?? none)}</Text>
        <Text style={line}>{text('account', snapshot.profile?.email ?? none)}</Text>
        {snapshot.warning === undefined ? null : <Text style={line}>{text('storageWarning')}</Text>}
        <Text testID={TEST_ID.LAST_OUTCOME} style={line}>
          {text('lastOutcome', lastOutcome ?? none)}
        </Text>
        <Text testID={TEST_ID.REFRESH_REQUESTS} style={line}>
          {text('refreshRequests', String(refreshRequests))}
        </Text>
      </View>
      <Button
        testID={TEST_ID.SIGN_IN}
        title={text('signIn')}
        accessibilityLabel={text('signInLabel')}
        onPress={signIn}
      />
      <Button
        testID={TEST_ID.REFRESH}
        title={text('refresh')}
        accessibilityLabel={text('refreshLabel')}
        onPress={refresh}
      />
      <Button
        testID={TEST_ID.LOAD_PROFILE}
        title={text('loadProfile')}
        accessibilityLabel={text('loadProfileLabel')}
        onPress={loadProfile}
      />
      <Button
        testID={TEST_ID.SIGN_OUT}
        title={text('signOut')}
        accessibilityLabel={text('signOutLabel')}
        onPress={signOut}
      />
    </ScrollView>
  );
}
