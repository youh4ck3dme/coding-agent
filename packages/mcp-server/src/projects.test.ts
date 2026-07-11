import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearProjectCatalogCache, listLocalProjects, resolveProjectRoot } from './projects';

describe('projects', () => {
  afterEach(() => {
    clearProjectCatalogCache();
    delete process.env.PROJECTS_ROOTS;
  });

  it('lists only directories with project markers under configured roots', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-projects-'));
    const workspace = join(root, 'workspace');
    const other = join(root, 'other');
    const nested = join(root, 'nested', 'app');
    mkdirSync(workspace, { recursive: true });
    mkdirSync(other, { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(workspace, 'package.json'), '{}');
    writeFileSync(join(nested, 'package.json'), '{}');

    process.env.PROJECTS_ROOTS = root;
    const projects = listLocalProjects(workspace);
    const paths = projects.map(project => project.path);

    expect(paths).toContain(realpathSync(workspace));
    expect(paths).toContain(realpathSync(nested));
    expect(paths).not.toContain(realpathSync(other));
  });

  it('resolves a catalog project by path', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-resolve-'));
    writeFileSync(join(root, 'package.json'), '{}');

    process.env.PROJECTS_ROOTS = root;
    expect(resolveProjectRoot(root, root)).toBe(realpathSync(root));
  });

  it('rejects workspaces outside the catalog', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'coding-agent-default-'));
    const outsider = mkdtempSync(join(tmpdir(), 'coding-agent-outsider-'));
    writeFileSync(join(workspace, 'package.json'), '{}');
    writeFileSync(join(outsider, 'package.json'), '{}');

    process.env.PROJECTS_ROOTS = workspace;
    expect(() => resolveProjectRoot(outsider, workspace)).toThrow(
      'Selected workspace is not in the local project catalog'
    );
  });

  it('reuses catalog cache between lookups', () => {
    const root = mkdtempSync(join(tmpdir(), 'coding-agent-cache-'));
    writeFileSync(join(root, 'package.json'), '{}');
    process.env.PROJECTS_ROOTS = root;

    const first = listLocalProjects(root);
    const second = listLocalProjects(root);

    expect(first).toBe(second);
  });
});