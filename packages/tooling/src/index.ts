import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function packageManager(workspaceRoot: string): 'pnpm' | 'npm' {
  return existsSync(join(workspaceRoot, 'pnpm-lock.yaml')) ? 'pnpm' : 'npm';
}

async function runCommand(
  workspaceRoot: string,
  command: string,
  args: string[] = []
): Promise<string> {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: workspaceRoot,
    maxBuffer: 10 * 1024 * 1024
  });
  return (stdout || stderr || '').trim();
}

/**
 * Wrapper around `git status --porcelain`. Returns the raw status output.
 */
export async function gitStatus(workspaceRoot: string): Promise<string> {
  return runCommand(workspaceRoot, 'git', ['status', '--porcelain']);
}

/**
 * Wrapper around `git diff`. Accepts optional arguments to narrow the diff.
 */
export async function gitDiff(workspaceRoot: string, args: string[] = []): Promise<string> {
  return runCommand(workspaceRoot, 'git', ['diff', ...args]);
}

/**
 * Run the lint script in the configured workspace.
 */
export async function runLint(workspaceRoot: string): Promise<string> {
  const pm = packageManager(workspaceRoot);
  return runCommand(workspaceRoot, pm, ['run', 'lint']);
}

/**
 * Run the test script in the configured workspace.
 */
export async function runTests(workspaceRoot: string): Promise<string> {
  const pm = packageManager(workspaceRoot);
  return runCommand(workspaceRoot, pm, ['run', 'test']);
}

/**
 * Run the build script in the configured workspace.
 */
export async function runBuild(workspaceRoot: string): Promise<string> {
  const pm = packageManager(workspaceRoot);
  return runCommand(workspaceRoot, pm, ['run', 'build']);
}