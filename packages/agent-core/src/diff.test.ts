import { describe, expect, it } from 'vitest';
import { buildUnifiedDiff } from './diff';

describe('buildUnifiedDiff', () => {
  it('reports no changes for identical content', () => {
    expect(buildUnifiedDiff('a.ts', 'same', 'same')).toContain('no changes');
  });

  it('shows line-level additions and removals', () => {
    const diff = buildUnifiedDiff('a.ts', 'line1\nold', 'line1\nnew');
    expect(diff).toContain('- old');
    expect(diff).toContain('+ new');
  });
});