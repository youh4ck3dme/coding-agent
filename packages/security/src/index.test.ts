import { describe, expect, it } from 'vitest';
import { isPathAllowed, redactSecrets } from './index';

describe('redactSecrets', () => {
  it('redacts api_key query values', () => {
    expect(redactSecrets('curl https://x?api_key=secret123')).toBe(
      'curl https://x?api_key=[REDACTED]'
    );
  });

  it('redacts api-key and API_KEY variants', () => {
    expect(redactSecrets('api-key=abc&API_KEY=xyz')).toBe(
      'api-key=[REDACTED]&API_KEY=[REDACTED]'
    );
  });

  it('leaves unrelated strings unchanged', () => {
    expect(redactSecrets('no secrets here')).toBe('no secrets here');
  });
});

describe('isPathAllowed', () => {
  it('allows paths under workspace root', () => {
    expect(isPathAllowed('/workspace', '/workspace/src/index.ts')).toBe(true);
  });

  it('blocks paths outside workspace root', () => {
    expect(isPathAllowed('/workspace', '/etc/passwd')).toBe(false);
  });
});