import { existsSync, readdirSync, realpathSync, statSync } from 'fs';
import { homedir } from 'os';
import { basename, join, resolve } from 'path';

const PROJECT_MARKERS = ['.git', 'package.json', 'pnpm-workspace.yaml', 'Cargo.toml', 'go.mod', 'pyproject.toml'];
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'Library',
  'Applications',
  'Downloads',
  'Pictures',
  'Movies',
  'Music'
]);
const MAX_PROJECTS = 500;
const MAX_DEPTH = 4;

export type LocalProject = {
  name: string;
  path: string;
};

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function projectSearchRoots(defaultWorkspace: string): string[] {
  const configured = process.env.PROJECTS_ROOTS
    ?.split(',')
    .map(path => path.trim())
    .filter(Boolean) ?? [];
  const roots = configured.length > 0
    ? configured
    : [defaultWorkspace, join(homedir(), 'Projects'), join(homedir(), 'Developer'), join(homedir(), 'Code'), join(homedir(), 'Documents'), join(homedir(), 'Desktop')];

  return [...new Set(roots.filter(isDirectory).map(path => realpathSync(path)))];
}

function isProjectDirectory(path: string): boolean {
  return PROJECT_MARKERS.some(marker => existsSync(join(path, marker)));
}

export function listLocalProjects(defaultWorkspace: string): LocalProject[] {
  const projects = new Map<string, LocalProject>();

  function visit(path: string, depth: number): void {
    if (projects.size >= MAX_PROJECTS || depth > MAX_DEPTH || !isDirectory(path)) {
      return;
    }

    const resolvedPath = realpathSync(path);
    if (isProjectDirectory(resolvedPath)) {
      projects.set(resolvedPath, { name: basename(resolvedPath), path: resolvedPath });
      return;
    }

    for (const entry of readdirSync(resolvedPath, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      visit(join(resolvedPath, entry.name), depth + 1);
    }
  }

  for (const root of projectSearchRoots(defaultWorkspace)) {
    visit(root, 0);
  }

  const resolvedDefault = realpathSync(defaultWorkspace);
  projects.set(resolvedDefault, { name: basename(resolvedDefault), path: resolvedDefault });
  return [...projects.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function resolveProjectRoot(workspaceRoot: unknown, defaultWorkspace: string): string {
  if (typeof workspaceRoot !== 'string' || !workspaceRoot.trim()) {
    return realpathSync(defaultWorkspace);
  }

  const selected = resolve(workspaceRoot);
  const project = listLocalProjects(defaultWorkspace).find(item => item.path === selected);
  if (!project) {
    throw new Error('Selected workspace is not in the local project catalog');
  }
  return project.path;
}
