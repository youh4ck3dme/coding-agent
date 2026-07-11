import { describe, expect, it } from 'vitest';
import { sanitizeMessageContent } from './sanitizeMessage';

describe('sanitizeMessageContent', () => {
  it('keeps plain text unchanged', () => {
    expect(sanitizeMessageContent('Ahoj svet')).toBe('Ahoj svet');
  });

  it('strips script tags', () => {
    expect(sanitizeMessageContent('Hi<script>alert(1)</script> there')).toBe('Hi there');
  });

  it('strips HTML elements', () => {
    expect(sanitizeMessageContent('<img src=x onerror=alert(1)> safe')).toBe(' safe');
  });
});