import { existsSync, statSync } from 'fs';
import { resolve, join } from 'path';
import { HttpRequestError } from './errors';

const SEARCH_PREFIXES = ['', 'packages', 'extensions'];

export type ResolvedPath = {
  absolute: string;
  relative: string;
};

export function normalizeRelativePath(relative: string): string {
  return relative.replace(/\\/g, '/').replace(/^\/+/, '');
}

function isInsideRoot(root: string, absolute: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedAbsolute = resolve(absolute);
  return (
    normalizedAbsolute === normalizedRoot ||
    normalizedAbsolute.startsWith(normalizedRoot + '/')
  );
}

function buildCandidates(relative: string): string[] {
  const normalized = normalizeRelativePath(relative);
  const candidates = new Set<string>([normalized]);

  if (!normalized.includes('/')) {
    for (const prefix of SEARCH_PREFIXES) {
      if (prefix) {
        candidates.add(join(prefix, normalized));
      }
    }
  }

  return [...candidates];
}

export function resolveWorkspacePath(
  root: string,
  relative: string,
  options: { mustExist?: boolean } = {}
): ResolvedPath {
  const candidates = buildCandidates(relative);

  for (const candidate of candidates) {
    const absolute = resolve(root, candidate);
    if (!isInsideRoot(root, absolute)) {
      throw new HttpRequestError(`Path traversal detected: ${relative}`, 403);
    }
    if (existsSync(absolute)) {
      return { absolute, relative: candidate };
    }
  }

  const fallback = resolve(root, normalizeRelativePath(relative));
  if (!isInsideRoot(root, fallback)) {
    throw new HttpRequestError(`Path traversal detected: ${relative}`, 403);
  }

  if (options.mustExist) {
    const suggestions = [...new Set(candidates)].filter(
      candidate => candidate !== normalizeRelativePath(relative)
    );
    const hint =
      suggestions.length > 0
        ? ` Try one of: ${suggestions.join(', ')}`
        : ' Use list_directory to explore the workspace.';
    throw new HttpRequestError(`Path not found: ${relative}.${hint}`, 404);
  }

  return {
    absolute: fallback,
    relative: normalizeRelativePath(relative)
  };
}

export function pathKind(absolute: string): 'file' | 'directory' | 'missing' {
  if (!existsSync(absolute)) {
    return 'missing';
  }
  return statSync(absolute).isDirectory() ? 'directory' : 'file';
}