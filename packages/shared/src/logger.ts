/**
 * Very basic logger used across the monorepo.  In a more sophisticated implementation
 * you might replace this with a structured logger (such as Pino) and write to
 * multiple destinations.  For now it simply proxies to `console.log`.
 */
export function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}