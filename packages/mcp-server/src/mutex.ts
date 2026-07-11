export function createMutex() {
  let chain: Promise<unknown> = Promise.resolve();

  return <T>(operation: () => Promise<T>): Promise<T> => {
    const run = chain.then(operation, operation);
    chain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}