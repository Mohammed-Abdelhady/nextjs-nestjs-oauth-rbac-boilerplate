import { createApiClient } from '@app/sdk';
import { configureStore } from '@reduxjs/toolkit';
import type { EnginePort } from '../types';
import { uiApi, type UiExtra } from './api';
import { createEpochTracker, type EpochTracker } from './epoch';
import { createSignInController, type SignInController } from './sign-in-controller';

function createStore(extra: UiExtra) {
  return configureStore({
    reducer: { [uiApi.reducerPath]: uiApi.reducer },
    middleware: (defaults) =>
      defaults({ thunk: { extraArgument: extra } }).concat(uiApi.middleware),
  });
}

export type UiStore = ReturnType<typeof createStore>;

export interface UiRuntime {
  engine: EnginePort;
  store: UiStore;
  epoch: Pick<EpochTracker, 'current'>;
  signIn: SignInController;
  /** Follows the engine until the returned function is called. */
  start(): () => void;
}

/** The store, the client and the sign-in attempt for one engine. */
export function createUiRuntime(engine: EnginePort): UiRuntime {
  const epoch = createEpochTracker(engine.snapshot);
  const store = createStore({ client: createApiClient(engine.transport) });
  const signIn = createSignInController(engine);

  const follow = (): void => {
    if (!epoch.observe(engine.snapshot)) return;
    // One account's answers must never be read by the next one.
    store.dispatch(uiApi.util.resetApiState());
    signIn.clear();
  };

  return {
    engine,
    store,
    epoch,
    signIn,
    start() {
      follow();
      return engine.subscribe(follow);
    },
  };
}
