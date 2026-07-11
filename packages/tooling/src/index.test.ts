import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import {
  __resetExecFileAsyncForTests,
  __setExecFileAsyncForTests,
  gitDiff,
  gitStatus,
  packageManager,
  runBuild,
  runLint,
  runTests
} from './index';

vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

const existsSyncMock = vi.mocked(existsSync);

function mockExecOutput(stdout: string, stderr = '') {
  __setExecFileAsyncForTests(async () => ({ stdout, stderr }));
}

describe('packageManager', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('prefers pnpm when lockfile exists', () => {
    existsSyncMock.mockReturnValue(true);
    expect(packageManager('/repo')).toBe('pnpm');
  });

  it('falls back to npm otherwise', () => {
    existsSyncMock.mockReturnValue(false);
    expect(packageManager('/repo')).toBe('npm');
  });
});

describe('tooling wrappers', () => {
  afterEach(() => {
    __resetExecFileAsyncForTests();
    vi.clearAllMocks();
  });

  it('runs git status --porcelain in workspace', async () => {
    mockExecOutput(' M README.md');
    await expect(gitStatus('/repo')).resolves.toBe('M README.md');
  });

  it('forwards extra diff arguments', async () => {
    mockExecOutput('diff output');
    await expect(gitDiff('/repo', ['--staged'])).resolves.toBe('diff output');
  });

  it('uses stderr when stdout is empty', async () => {
    mockExecOutput('', 'warning');
    await expect(gitStatus('/repo')).resolves.toBe('warning');
  });

  it('runs lint via pnpm when lockfile exists', async () => {
    existsSyncMock.mockReturnValue(true);
    mockExecOutput('lint ok');
    await expect(runLint('/repo')).resolves.toBe('lint ok');
  });

  it('runs tests via npm without pnpm lockfile', async () => {
    existsSyncMock.mockReturnValue(false);
    mockExecOutput('tests ok');
    await expect(runTests('/repo')).resolves.toBe('tests ok');
  });

  it('runs build via detected package manager', async () => {
    existsSyncMock.mockReturnValue(true);
    mockExecOutput('build ok');
    await expect(runBuild('/repo')).resolves.toBe('build ok');
  });
});