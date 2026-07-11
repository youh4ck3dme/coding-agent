import { describe, expect, it } from 'vitest';
import { executeToolCall, getToolsForMode } from './tools';

describe('getToolsForMode', () => {
  it('returns read-only tools for qa regardless of mode', () => {
    const tools = getToolsForMode('edit', 'qa');
    const names = tools.map(tool => tool.function.name);
    expect(names).toContain('read_file');
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('append_file');
  });

  it('includes write tools for edit mode without role', () => {
    const names = getToolsForMode('edit').map(tool => tool.function.name);
    expect(names).toContain('write_file');
    expect(names).toContain('run_build');
  });
});

describe('executeToolCall', () => {
  const client = {
    readFile: async () => ({ data: 'old', path: 'packages/web/a.ts' }),
    writeFile: async () => ({ ok: true, path: 'packages/web/a.ts' })
  } as never;

  it('blocks qa writes before hitting MCP', async () => {
    const result = await executeToolCall(
      'write_file',
      JSON.stringify({ file: 'packages/web/a.ts', content: 'new' }),
      client,
      { role: 'qa', autoApprove: true }
    );
    expect(result).toEqual({ ok: false, error: 'QA rola nemôže zapisovať do súborov.' });
  });

  it('blocks frontend role from writing backend paths', async () => {
    const result = await executeToolCall(
      'write_file',
      JSON.stringify({ file: 'packages/mcp-server/src/index.ts', content: 'new' }),
      client,
      { role: 'frontend', autoApprove: true }
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain('mimo rozsahu');
  });
});