import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import type {
  AuthSnapshot,
  RefreshOutcome,
  RestoreOutcome,
  RevocationOutcome,
  SignInOutcome,
  SignOutOutcome,
} from '@app/native-auth';
import { AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION } from './config';
import { createNativeShellAuth } from './engine';
import { deviceLocale, textDirection, type Locale } from './locale';
import { MESSAGES, type MessageKey } from './messages';

const AUTH = createNativeShellAuth(AUTH_CONFIGURATION, EPHEMERAL_BROWSER_SESSION);
const ENGINE = AUTH.engine;
const API = AUTH.client;
let restoreTask: Promise<RestoreOutcome> | undefined;

type ActionName = 'signIn' | 'refresh' | 'profile' | 'signOut';
type StatusKey =
  | 'statusRestoring'
  | 'statusSignedOut'
  | 'statusSignedIn'
  | 'statusReauthRequired'
  | 'statusStorageBlocked';
type OperationKey =
  | 'operationNone'
  | 'operationAuthorizing'
  | 'operationExchanging'
  | 'operationRefreshing'
  | 'operationSigningOut';

const STATUS_MESSAGE: Record<AuthSnapshot['status'], StatusKey> = {
  restoring: 'statusRestoring',
  signedOut: 'statusSignedOut',
  signedIn: 'statusSignedIn',
  reauthRequired: 'statusReauthRequired',
  storageBlocked: 'statusStorageBlocked',
};

const RESTORE_OUTCOME_MESSAGE: Record<RestoreOutcome['kind'], MessageKey> = {
  disposed: 'restoreDisposed',
  restored: 'restoreComplete',
  storageBlocked: 'restoreBlocked',
};

const OPERATION_MESSAGE: Record<AuthSnapshot['operation'], OperationKey> = {
  none: 'operationNone',
  authorizing: 'operationAuthorizing',
  exchanging: 'operationExchanging',
  refreshing: 'operationRefreshing',
  signingOut: 'operationSigningOut',
};

const REASON_MESSAGE: Record<NonNullable<AuthSnapshot['reason']>, MessageKey> = {
  storageFailure: 'reasonStorageFailure',
  storageLocked: 'reasonStorageLocked',
  invalidRecord: 'reasonInvalidRecord',
  installMismatch: 'reasonInstallMismatch',
  refreshInterrupted: 'reasonRefreshInterrupted',
  oauthFailure: 'reasonOauthFailure',
  disabled: 'reasonDisabled',
  profileFailure: 'reasonProfileFailure',
  authorizationDenied: 'reasonAuthorizationDenied',
  deviceKeyUnavailable: 'reasonDeviceKeyUnavailable',
  deviceKeyInvalidated: 'reasonDeviceKeyInvalidated',
  deviceBindingRequired: 'reasonDeviceBindingRequired',
};

const SIGN_IN_OUTCOME_MESSAGE: Record<SignInOutcome['kind'], MessageKey> = {
  disposed: 'signInDisposed',
  signedIn: 'signInComplete',
  alreadySignedIn: 'signInAlreadyActive',
  signedOut: 'signInSuperseded',
  cancelled: 'signInCancelled',
  dismissed: 'signInDismissed',
  expired: 'signInFailed',
  cryptoFailure: 'signInFailed',
  clockFailure: 'signInFailed',
  browserFailure: 'signInFailed',
  authorizationDenied: 'signInFailed',
  invalidCallback: 'signInFailed',
  disabled: 'signInFailed',
  oauthFailure: 'signInFailed',
  throttled: 'signInFailed',
  transportFailure: 'signInFailed',
  aborted: 'signInInterrupted',
  apiFailure: 'signInFailed',
  storageFailure: 'signInFailed',
  deviceBindingRequired: 'signInDeviceBindingRequired',
  deviceKeyFailure: 'signInDeviceKeyFailure',
};

const REFRESH_OUTCOME_MESSAGE: Record<RefreshOutcome['kind'], MessageKey> = {
  disposed: 'refreshDisposed',
  refreshed: 'refreshComplete',
  notSignedIn: 'refreshNotSignedIn',
  failed: 'refreshFailed',
};

const SIGN_OUT_DISPOSED_MESSAGE: MessageKey = 'signOutDisposed';

const REVOCATION_MESSAGE: Record<RevocationOutcome, MessageKey> = {
  notNeeded: 'signOutNoRevocationNeeded',
  recordUnavailable: 'signOutRecordUnavailable',
  revoked: 'signOutComplete',
  failed: 'signOutFailed',
  timedOut: 'signOutTimedOut',
};

function outcomeForRestore(outcome: RestoreOutcome): MessageKey {
  return RESTORE_OUTCOME_MESSAGE[outcome.kind];
}

function outcomeForSignOut(outcome: SignOutOutcome): MessageKey {
  if (outcome.kind === 'disposed') return SIGN_OUT_DISPOSED_MESSAGE;
  return REVOCATION_MESSAGE[outcome.revocation];
}

function textFor(locale: Locale, key: MessageKey): string {
  return MESSAGES[locale][key];
}

function restoreOnce(): Promise<RestoreOutcome> {
  restoreTask ??= ENGINE.restore();
  return restoreTask;
}

export default function App(): JSX.Element {
  const locale = deviceLocale();
  const messages = MESSAGES[locale];
  const direction = textDirection(locale);
  const textStyle = locale === 'ar' ? styles.arabicText : styles.englishText;
  const [snapshot, setSnapshot] = useState(ENGINE.snapshot);
  const [lastOutcome, setLastOutcome] = useState<MessageKey>('ready');
  const [busyAction, setBusyAction] = useState<ActionName | undefined>();
  const busy = useRef(false);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = ENGINE.subscribe(setSnapshot);
    void restoreOnce().then(
      (outcome) => {
        if (mounted) setLastOutcome(outcomeForRestore(outcome));
      },
      () => {
        if (mounted) setLastOutcome('restoreBlocked');
      },
    );
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const runExclusive = useCallback(async (action: ActionName, work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setBusyAction(action);
    try {
      await work();
    } catch {
      setLastOutcome('requestFailed');
    } finally {
      busy.current = false;
      setBusyAction(undefined);
    }
  }, []);

  const signIn = useCallback(() => {
    void runExclusive('signIn', async () => {
      const outcome = await ENGINE.signIn();
      setLastOutcome(SIGN_IN_OUTCOME_MESSAGE[outcome.kind]);
    });
  }, [runExclusive]);

  const refresh = useCallback(() => {
    void runExclusive('refresh', async () => {
      const outcome = await ENGINE.refresh();
      setLastOutcome(REFRESH_OUTCOME_MESSAGE[outcome.kind]);
    });
  }, [runExclusive]);

  const callProfile = useCallback(() => {
    void runExclusive('profile', async () => {
      try {
        await API.profile.get();
        setLastOutcome('profileComplete');
      } catch {
        setLastOutcome('requestFailed');
      }
    });
  }, [runExclusive]);

  const signOut = useCallback(() => {
    void runExclusive('signOut', async () => {
      const outcome = await ENGINE.signOut();
      setLastOutcome(outcomeForSignOut(outcome));
    });
  }, [runExclusive]);

  return (
    <View style={[styles.container, { direction }]}>
      <Text accessibilityRole="header" style={[styles.text, textStyle]}>
        {messages.title}
      </Text>
      <View style={styles.section}>
        <Text style={[styles.label, textStyle]}>{messages.sessionState}</Text>
        <Text style={[styles.text, textStyle]}>{messages[STATUS_MESSAGE[snapshot.status]]}</Text>
        <Text style={[styles.label, textStyle]}>{messages.operation}</Text>
        <Text style={[styles.text, textStyle]}>
          {messages[OPERATION_MESSAGE[snapshot.operation]]}
        </Text>
        <Text style={[styles.label, textStyle]}>{messages.profile}</Text>
        <Text style={[styles.text, textStyle]}>
          {snapshot.profile ? messages.profileLoaded : messages.profileNotLoaded}
        </Text>
        {snapshot.reason ? (
          <Text style={[styles.text, textStyle]}>
            {messages.reason}
            {textFor(locale, REASON_MESSAGE[snapshot.reason])}
          </Text>
        ) : null}
        {snapshot.warning ? (
          <Text style={[styles.text, textStyle]}>{messages.warningStorageBlocked}</Text>
        ) : null}
      </View>
      <View style={styles.section}>
        <Text style={[styles.label, textStyle]}>{messages.lastOutcome}</Text>
        <Text style={[styles.text, textStyle]}>{messages[lastOutcome]}</Text>
      </View>
      <Button
        title={messages.signInButton}
        accessibilityLabel={messages.signInButton}
        disabled={busyAction !== undefined}
        onPress={signIn}
      />
      <Button
        title={messages.refreshButton}
        accessibilityLabel={messages.refreshButtonLabel}
        disabled={busyAction !== undefined}
        onPress={refresh}
      />
      <Button
        title={messages.profileButton}
        accessibilityLabel={messages.profileButton}
        disabled={busyAction !== undefined}
        onPress={callProfile}
      />
      <Button
        title={messages.signOutButton}
        accessibilityLabel={messages.signOutButton}
        disabled={busyAction !== undefined}
        onPress={signOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  section: { gap: 4 },
  text: { fontSize: 16 },
  label: { fontSize: 14 },
  englishText: { writingDirection: 'ltr' },
  arabicText: { writingDirection: 'rtl' },
});
