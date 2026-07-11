import { describe, expect, it } from 'vitest';
import { loadWorkspaceConfig } from './config';

describe('loadWorkspaceConfig', () => {
  it('defaults MCP_SERVER_URL from port', () => {
    const config = loadWorkspaceConfig({
      WORKSPACE_ROOT: '/tmp/demo',
      MCP_SERVER_PORT: '4242'
    });

    expect(config.WORKSPACE_ROOT).toBe('/tmp/demo');
    expect(config.MCP_SERVER_PORT).toBe(4242);
    expect(config.MCP_SERVER_URL).toBe('http://127.0.0.1:4242');
  });

  it('keeps explicit MCP_SERVER_URL', () => {
    const config = loadWorkspaceConfig({
      WORKSPACE_ROOT: '/tmp/demo',
      MCP_SERVER_URL: 'http://localhost:9999'
    });

    expect(config.MCP_SERVER_URL).toBe('http://localhost:9999');
  });

  it('throws when MCP_SERVER_URL is invalid', () => {
    expect(() =>
      loadWorkspaceConfig({
        MCP_SERVER_URL: 'not-a-url'
      })
    ).toThrow('Invalid environment');
  });
});