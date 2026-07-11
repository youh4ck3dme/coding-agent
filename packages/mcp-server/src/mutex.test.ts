import { describe, expect, it } from 'vitest';
import { createMutex } from './mutex';

describe('createMutex', () => {
  it('serializes concurrent operations', async () => {
    const mutex = createMutex();
    const order: number[] = [];

    await Promise.all([
      mutex(async () => {
        order.push(1);
        await new Promise(resolve => setTimeout(resolve, 30));
        order.push(2);
      }),
      mutex(async () => {
        order.push(3);
      })
    ]);

    expect(order).toEqual([1, 2, 3]);
  });
});