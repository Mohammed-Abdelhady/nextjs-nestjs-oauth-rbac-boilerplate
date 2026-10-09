import { Alert } from 'react-native';
import type { Confirm } from '../types';

/** The platform's own dialog, so focus, dismissal and direction are the system's. */
export const confirmWithAlert: Confirm = ({ title, message, confirmLabel, cancelLabel }) =>
  new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
