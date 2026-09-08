'use client';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { LoadingRegion } from '@/components/layout/LoadingRegion';
import { store, persistor } from '@/store/store';

interface ReduxProviderProps {
  readonly children: React.ReactNode;

  /**
   * Announced while the persisted store rehydrates. It comes from the server
   * layout because this provider sits above the next-intl client provider.
   */
  readonly loadingLabel: string;
}

/**
 * Redux Provider wrapper for Next.js App Router with persistence
 * Marked as 'use client' to enable Redux in client components
 * Wraps the app with Redux store provider and PersistGate for state rehydration
 *
 * @example
 * <ReduxProvider loadingLabel="Loading...">
 *   <YourApp />
 * </ReduxProvider>
 */
export function ReduxProvider({ children, loadingLabel }: Readonly<ReduxProviderProps>) {
  return (
    <Provider store={store}>
      <PersistGate
        loading={<LoadingRegion label={loadingLabel} testId="store-rehydration-loading" />}
        persistor={persistor}
      >
        {children}
      </PersistGate>
    </Provider>
  );
}
