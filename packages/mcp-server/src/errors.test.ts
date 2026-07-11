import { describe, expect, it } from 'vitest';
import { HttpRequestError, toHttpError } from './errors';

describe('toHttpError', () => {
  it('preserves HttpRequestError instances', () => {
    const error = new HttpRequestError('Forbidden', 403);
    expect(toHttpError(error)).toBe(error);
  });

  it('maps path not found to 404', () => {
    expect(toHttpError(new Error('Path not found: foo.ts')).statusCode).toBe(404);
  });

  it('maps path traversal to 403', () => {
    expect(toHttpError(new Error('Path traversal detected: ../etc')).statusCode).toBe(403);
  });

  it('maps missing parameters to 400', () => {
    expect(toHttpError(new Error('Missing file query parameter')).statusCode).toBe(400);
  });

  it('defaults unknown errors to 500', () => {
    expect(toHttpError(new Error('boom')).statusCode).toBe(500);
  });
});