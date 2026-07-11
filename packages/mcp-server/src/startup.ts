import { execSync } from 'child_process';

export async function ensurePortAvailable(
  port: number,
  healthUrl: string
): Promise<'running' | 'ready'> {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const payload = (await response.json()) as { ok?: boolean };
      if (payload.ok === true) {
        console.log(`MCP server already running at ${healthUrl}`);
        return 'running';
      }
    }
  } catch {
    // Port is free or occupied by another process.
  }

  try {
    execSync(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, {
      stdio: 'ignore',
      shell: '/bin/bash'
    });
  } catch {
    // Nothing to kill.
  }

  return 'ready';
}