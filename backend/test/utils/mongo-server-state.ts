export interface SharedMongoServer {
  uri: string;
  port: number;
  dataPath: string;
  stop: () => Promise<void>;
}

export interface SharedMongoRun {
  servers: SharedMongoServer[];
  previousUris: string | undefined;
}

type ProcessWithMongoRun = typeof process & {
  __backendTestMongoRun?: SharedMongoRun;
};

function processWithMongoRun(): ProcessWithMongoRun {
  return process;
}

export function hasSharedMongoRun(): boolean {
  return processWithMongoRun().__backendTestMongoRun !== undefined;
}

export function setSharedMongoRun(
  servers: SharedMongoServer[],
  previousUris: string | undefined,
): void {
  processWithMongoRun().__backendTestMongoRun = { servers, previousUris };
}

export function takeSharedMongoRun(): SharedMongoRun | undefined {
  const currentProcess = processWithMongoRun();
  const run = currentProcess.__backendTestMongoRun;
  delete currentProcess.__backendTestMongoRun;
  return run;
}
