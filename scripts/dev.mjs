#!/usr/bin/env node
import { spawn, spawnSync, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = loadProjectEnv(root);
const mcpUrl = env.MCP_SERVER_URL || `http://127.0.0.1:${env.MCP_SERVER_PORT || 3000}`;
const mcpPort = Number(new URL(mcpUrl).port || env.MCP_SERVER_PORT || 3000);
const workspaceRoot = env.WORKSPACE_ROOT || root;
const [, , command, ...rest] = process.argv;

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  const values = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const [key, ...parts] = trimmed.split('=');
    values[key.trim()] = parts.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

function loadProjectEnv(projectRoot) {
  return {
    ...parseEnvFile(join(projectRoot, '.env')),
    ...parseEnvFile(join(projectRoot, '.env.local'))
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isHealthy() {
  try {
    const response = await fetch(`${mcpUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    return payload.ok === true;
  } catch {
    return false;
  }
}

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const script = [
        `$connections = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
        '$connections | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }'
      ].join('; ');
      spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        cwd: root,
        stdio: 'ignore'
      });
    } else {
      execSync(`lsof -ti tcp:${port} | xargs kill -9 2>/dev/null || true`, {
        cwd: root,
        stdio: 'ignore',
        shell: true
      });
    }
  } catch {
    // No process on port.
  }
}

async function waitForHealth(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isHealthy()) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

function runCli(mode, args) {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@coding-agent/cli', 'dev', mode, ...args],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ...env, MCP_SERVER_URL: mcpUrl, WORKSPACE_ROOT: workspaceRoot }
    }
  );
  process.exit(result.status ?? 1);
}

function buildWebUi() {
  console.log('Building chat UI...');
  const result = spawnSync('pnpm', ['--filter', '@coding-agent/web', 'build'], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    console.error('Web UI build failed');
    process.exit(result.status ?? 1);
  }
}

async function startMcpForeground() {
  if (await isHealthy()) {
    console.log(`MCP server already running at ${mcpUrl}`);
    console.log(`Chat UI: ${mcpUrl}`);
    console.log('Stop it with: pnpm dev:stop');
    return;
  }

  buildWebUi();
  killPort(mcpPort);
  console.log(`Starting MCP server on ${mcpUrl} ...`);

  const child = spawn('pnpm', ['--filter', '@coding-agent/mcp-server', 'dev'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
      MCP_SERVER_URL: mcpUrl,
      MCP_SERVER_PORT: String(mcpPort),
      WORKSPACE_ROOT: workspaceRoot
    }
  });

  child.on('exit', code => process.exit(code ?? 1));
}

async function ensureMcpBackground() {
  if (await isHealthy()) {
    return;
  }

  buildWebUi();
  killPort(mcpPort);
  const child = spawn('pnpm', ['--filter', '@coding-agent/mcp-server', 'dev'], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
    env: {
      ...process.env,
      ...env,
      MCP_SERVER_URL: mcpUrl,
      MCP_SERVER_PORT: String(mcpPort),
      WORKSPACE_ROOT: workspaceRoot
    }
  });
  child.unref();

  if (!(await waitForHealth())) {
    console.error(`Failed to start MCP server at ${mcpUrl}`);
    process.exit(1);
  }

  console.log(`MCP server ready at ${mcpUrl}`);
}

async function main() {
  if (command === 'stop') {
    killPort(mcpPort);
    console.log(`Stopped processes on port ${mcpPort}`);
    return;
  }

  if (
    command === 'ask' ||
    command === 'plan' ||
    command === 'apply' ||
    command === 'agent' ||
    command === 'parallel'
  ) {
    await ensureMcpBackground();
    runCli(command, rest);
    return;
  }

  if (command === 'status') {
    const healthy = await isHealthy();
    console.log(healthy ? `MCP online: ${mcpUrl}` : `MCP offline: ${mcpUrl}`);
    console.log('Use: pnpm dev | pnpm dev ask "..." | pnpm dev:stop');
    process.exit(healthy ? 0 : 1);
  }

  if (command) {
    console.error(`Unknown command: ${command}`);
    console.error('Usage:');
    console.error('  pnpm dev');
    console.error('  pnpm dev status');
    console.error('  pnpm dev ask "otázka"');
    console.error('  pnpm dev plan "úloha"');
    console.error('  pnpm dev apply "úloha"');
    console.error('  pnpm dev apply --yes "úloha"');
    console.error('  pnpm dev agent frontend "úloha"');
    console.error('  pnpm dev agent backend "úloha"');
    console.error('  pnpm dev agent qa "úloha"');
    console.error('  pnpm dev parallel "úloha"');
    console.error('  pnpm dev:stop');
    console.error('');
    console.error('Do not run MCP/CLI via --filter. Always use pnpm dev.');
    process.exit(1);
  }

  await startMcpForeground();
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
