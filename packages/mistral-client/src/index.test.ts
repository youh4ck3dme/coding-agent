import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@coding-agent/shared/dist/config', () => ({
  loadConfig: () => ({
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_MODEL: 'codestral-latest',
    MCP_SERVER_PORT: 3000,
    MCP_SERVER_URL: 'http://127.0.0.1:3000',
    WORKSPACE_ROOT: '/tmp'
  })
}));

import { chatCompletion } from './index';

describe('chatCompletion', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
            status: 200
          })
        )
      )
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts messages with model and auth header', async () => {
    const messages = [{ role: 'user', content: 'ping' }];
    await chatCompletion(messages);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          model: 'codestral-latest',
          messages
        })
      })
    );
  });

  it('includes tools when provided', async () => {
    const tools = [{ type: 'function', function: { name: 'read_file' } }];
    await chatCompletion([{ role: 'user', content: 'read' }], tools);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          model: 'codestral-latest',
          messages: [{ role: 'user', content: 'read' }],
          tools,
          tool_choice: 'auto'
        })
      })
    );
  });

  it('throws formatted error on failed response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'rate limited' }), { status: 429 })
        )
      )
    );

    await expect(chatCompletion([{ role: 'user', content: 'x' }])).rejects.toThrow(
      'Mistral request failed (429): rate limited'
    );
  });
});