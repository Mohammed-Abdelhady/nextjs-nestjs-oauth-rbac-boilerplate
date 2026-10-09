import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { ROUTE, type Route } from '../constants';
import { ARRIVAL, type Arrival } from '../components/Screen';

interface Location {
  route: Route;
  arrival: Arrival;
}

const HOME: Location = { route: ROUTE.ACCOUNT, arrival: ARRIVAL.NONE };

/** Account, with the sessions screen one step in. The system back button steps out. */
export function useRoute() {
  const [location, setLocation] = useState(HOME);
  const openSessions = useCallback(
    () => setLocation({ route: ROUTE.SESSIONS, arrival: ARRIVAL.FORWARD }),
    [],
  );
  const goBack = useCallback(
    () => setLocation({ route: ROUTE.ACCOUNT, arrival: ARRIVAL.BACK }),
    [],
  );

  const nested = location.route !== ROUTE.ACCOUNT;
  useEffect(() => {
    if (!nested) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, nested]);

  return { ...location, openSessions, goBack };
}
