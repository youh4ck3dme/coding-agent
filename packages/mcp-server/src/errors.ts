export class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

export function toHttpError(error: unknown): HttpRequestError {
  if (error instanceof HttpRequestError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  if (message.includes('Path not found') || message.includes('Not a file') || message.includes('Not a directory')) {
    return new HttpRequestError(message, 404);
  }
  if (message.includes('Path traversal')) {
    return new HttpRequestError(message, 403);
  }
  if (message.includes('Missing')) {
    return new HttpRequestError(message, 400);
  }

  return new HttpRequestError(message, 500);
}