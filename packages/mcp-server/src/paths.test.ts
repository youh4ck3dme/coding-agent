import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { HttpRequestError } from './errors';
import { normalizeRelativePath, pathKind, resolveWorkspacePath } from './paths';

describe('paths', () => {
  it('normalizes leading slashes and backslashes', () => {
    expect(normalizeRelativePath('\\packages\\web')).toBe('packages/web');
    expect(normalizeRelativePath('/README.md')).toBe('README.md');
  });

  it('resolves package shorthand to packages/agent-core', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-paths-'));
    const target = join(root, 'packages', 'agent-core');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'package.json'), '{}');

    const resolved = resolveWorkspacePath(root, 'agent-core', { mustExist: true });
    expect(resolved.relative).toBe('packages/agent-core');
    expect(realpathSync(resolved.absolute)).toBe(realpathSync(target));
  });

  it('rejects path traversal outside workspace', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-traversal-'));
    expect(() => resolveWorkspacePath(root, '../../../etc/passwd', { mustExist: true })).toThrow(
      HttpRequestError
    );
  });

  it('reports missing files with suggestions', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-missing-'));
    try {
      resolveWorkspacePath(root, 'missing.ts', { mustExist: true });
      expect.unreachable('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpRequestError);
      expect((error as HttpRequestError).statusCode).toBe(404);
      expect((error as HttpRequestError).message).toContain('packages/missing.ts');
    }
  });

  it('detects file vs directory kinds', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-kind-'));
    const file = join(root, 'note.txt');
    const dir = join(root, 'folder');
    writeFileSync(file, 'ok');
    mkdirSync(dir);

    expect(pathKind(file)).toBe('file');
    expect(pathKind(dir)).toBe('directory');
    expect(pathKind(join(root, 'absent'))).toBe('missing');
  });
});