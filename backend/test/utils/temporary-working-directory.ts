let directoryQueue: Promise<void> = Promise.resolve();

export async function withTemporaryWorkingDirectory<Result>(
  directory: string,
  task: () => Promise<Result>,
): Promise<Result> {
  const previousTask = directoryQueue;
  let release = (): void => undefined;
  directoryQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previousTask;

  let previousDirectory: string | undefined;
  try {
    previousDirectory = process.cwd();
    process.chdir(directory);
    return await task();
  } finally {
    try {
      if (previousDirectory !== undefined) {
        process.chdir(previousDirectory);
      }
    } finally {
      release();
    }
  }
}
