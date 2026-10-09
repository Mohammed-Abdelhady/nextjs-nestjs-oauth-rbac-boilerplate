import type { AuthSnapshot } from '@app/native-auth';
import type { Session } from '@app/sdk';
import { uiApi } from '../../src/state/api';
import { createUiRuntime, type UiRuntime } from '../../src/state/runtime';
import { createFakeEngine, type FakeEngine } from './fake-engine';
import { createFakeServer, ROUTE, sessionList, settle, type FakeServer } from './fake-server';

export interface Subject {
  runtime: UiRuntime;
  server: FakeServer;
  fake: FakeEngine;
  /** The sessions the store would hand a screen right now. */
  shown(): string[] | undefined;
  /** Requests the list and answers it. */
  load(sessions: Session[]): Promise<void>;
}

export function createSubject(initial: AuthSnapshot): Subject {
  const server = createFakeServer();
  const fake = createFakeEngine(server.transport, initial);
  const runtime = createUiRuntime(fake.engine);
  runtime.start();
  const select = uiApi.endpoints.listSessions.select();
  return {
    runtime,
    server,
    fake,
    shown: () => select(runtime.store.getState()).data?.map((row) => row.id),
    async load(sessions) {
      void runtime.store.dispatch(uiApi.endpoints.listSessions.initiate());
      await settle();
      server.answer(ROUTE.SESSIONS, sessionList(sessions));
      await settle();
    },
  };
}
