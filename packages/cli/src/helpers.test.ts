import { describe, expect, it } from 'vitest';
import { formatApprovalPrompt, isAgentRole, isApprovalAnswer } from './helpers';

describe('formatApprovalPrompt', () => {
  it('includes file path and approval question', () => {
    const prompt = formatApprovalPrompt({ file: 'src/index.ts' });
    expect(prompt).toContain('src/index.ts');
    expect(prompt).toContain('Approve this change?');
  });

  it('includes change ratio and diff when provided', () => {
    const prompt = formatApprovalPrompt({
      file: 'src/app.ts',
      changeRatio: 0.125,
      diff: '+ added line'
    });
    expect(prompt).toContain('12.5%');
    expect(prompt).toContain('+ added line');
  });
});

describe('isAgentRole', () => {
  it('accepts known roles', () => {
    expect(isAgentRole('frontend')).toBe(true);
    expect(isAgentRole('backend')).toBe(true);
    expect(isAgentRole('qa')).toBe(true);
  });

  it('rejects unknown roles', () => {
    expect(isAgentRole('devops')).toBe(false);
  });
});

describe('isApprovalAnswer', () => {
  it('accepts y and yes variants', () => {
    expect(isApprovalAnswer('y')).toBe(true);
    expect(isApprovalAnswer('Y')).toBe(true);
    expect(isApprovalAnswer(' yes ')).toBe(true);
    expect(isApprovalAnswer('YES')).toBe(true);
  });

  it('rejects other answers', () => {
    expect(isApprovalAnswer('n')).toBe(false);
    expect(isApprovalAnswer('')).toBe(false);
  });
});