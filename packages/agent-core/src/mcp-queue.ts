const MAX_CONCURRENT = 4;
let active = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return Promise.resolve();
  }
  return new Promise(resolve => waiters.push(resolve));
}

function release() {
  active--;
  const next = waiters.shift();
  if (next) {
    active++;
    next();
  }
}

export async function withMcpConcurrency<T>(operation: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    return await operation();
  } finally {
    release();
  }
}