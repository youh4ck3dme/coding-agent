import { describe, expect, it } from 'vitest';
import { withMcpConcurrency } from './mcp-queue';

describe('withMcpConcurrency', () => {
  it('limits parallel operations to four', async () => {
    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 8 }, () =>
      withMcpConcurrency(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 20));
        active--;
      })
    );

    await Promise.all(tasks);
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(maxActive).toBeGreaterThan(1);
  });
});