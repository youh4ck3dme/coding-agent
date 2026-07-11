import { extractAgentText, runAgent } from '@coding-agent/agent-core';
import { AgentMode } from '@coding-agent/shared/dist/types';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'fs';
import { readFile, writeFile, readdir, appendFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { loadWorkspaceConfig } from '@coding-agent/shared/dist/config';
import {
  gitDiff,
  gitStatus,
  runBuild,
  runLint,
  runTests
} from '@coding-agent/tooling';
import { HttpRequestError, toHttpError } from './errors';
import { createMutex } from './mutex';
import { pathKind, resolveWorkspacePath } from './paths';
import { listLocalProjects, resolveProjectRoot } from './projects';
import { ensurePortAvailable } from './startup';

const config = loadWorkspaceConfig();
const writeMutex = createMutex();
const gitMutex = createMutex();
const verifyMutex = createMutex();

function parseArgs(raw: unknown): string[] {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map(String);
  }
  return String(raw)
    .split(/\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function resolveWebDist(): string {
  return join(__dirname, '../../web/dist');
}

function workspaceRootFrom(value: unknown): string {
  const workspaceRoot = (value as { workspaceRoot?: unknown } | undefined)?.workspaceRoot;
  return resolveProjectRoot(workspaceRoot, config.WORKSPACE_ROOT);
}

type RouteHandler = (
  request: { query?: unknown; body?: unknown },
  reply: { status: (code: number) => { send: (payload: unknown) => unknown } }
) => Promise<unknown>;

function withHttpErrors(handler: RouteHandler): RouteHandler {
  return async (request, reply) => {
    try {
      return await handler(request, reply);
    } catch (error) {
      const httpError = toHttpError(error);
      return reply.status(httpError.statusCode).send({ error: httpError.message });
    }
  };
}

export async function buildServer() {
  const server = Fastify();

  server.setErrorHandler((error, _request, reply) => {
    const httpError = toHttpError(error);
    return reply.status(httpError.statusCode).send({
      error: httpError.message
    });
  });

  server.get('/health', async () => ({
    ok: true,
    workspaceRoot: config.WORKSPACE_ROOT,
    mcpUrl: config.MCP_SERVER_URL,
    ui: existsSync(resolveWebDist())
  }));

  server.post('/api/chat', async (request, reply) => {
    const body = request.body as {
      mode?: string;
      message?: string;
      autoApprove?: boolean;
      workspaceRoot?: string;
    };
    const message = body.message?.trim();
    if (!message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    const modeInput = body.mode ?? 'ask';
    const mode: AgentMode =
      modeInput === 'apply' ? 'edit' : (modeInput as AgentMode);

    if (!['ask', 'plan', 'edit', 'verify', 'review'].includes(mode)) {
      return reply.status(400).send({ error: `invalid mode: ${modeInput}` });
    }

    const result = await runAgent(mode, message, {
      autoApprove: Boolean(body.autoApprove),
      workspaceRoot: workspaceRootFrom(body)
    });

    return {
      text: extractAgentText(result),
      toolCalls: result.toolCalls
    };
  });

  server.get('/api/projects', async () => ({
    projects: listLocalProjects(config.WORKSPACE_ROOT),
    selectedProject: resolveProjectRoot(undefined, config.WORKSPACE_ROOT)
  }));

  server.get('/read_file', withHttpErrors(async (request) => {
    const query = request.query as { file?: string; workspaceRoot?: string };
    const file = query.file;
    if (!file) {
      throw new HttpRequestError('Missing file query parameter', 400);
    }
    const resolved = resolveWorkspacePath(workspaceRootFrom(query), file, { mustExist: true });
    if (pathKind(resolved.absolute) !== 'file') {
      throw new HttpRequestError(`Not a file: ${resolved.relative}`, 404);
    }
    const data = await readFile(resolved.absolute, 'utf8');
    return { data, path: resolved.relative };
  }));

  server.post('/write_file', withHttpErrors(async (request) => {
    return writeMutex(async () => {
      const body = request.body as { file?: string; content?: string; workspaceRoot?: string };
      const { file, content } = body;
      if (!file || content === undefined) {
        throw new Error('Missing file or content in request body');
      }
      const resolved = resolveWorkspacePath(workspaceRootFrom(body), file);
      await mkdir(dirname(resolved.absolute), { recursive: true });
      await writeFile(resolved.absolute, content, 'utf8');
      return { ok: true, path: resolved.relative };
    });
  }));

  server.post('/append_file', withHttpErrors(async (request) => {
    return writeMutex(async () => {
      const body = request.body as { file?: string; content?: string; workspaceRoot?: string };
      const { file, content } = body;
      if (!file || content === undefined) {
        throw new Error('Missing file or content in request body');
      }
      const resolved = resolveWorkspacePath(workspaceRootFrom(body), file, { mustExist: true });
      if (pathKind(resolved.absolute) !== 'file') {
        throw new Error(`Not a file: ${resolved.relative}`);
      }
      await appendFile(resolved.absolute, content, 'utf8');
      return { ok: true, path: resolved.relative };
    });
  }));

  server.get('/list_directory', withHttpErrors(async (request) => {
    const query = request.query as { dir?: string; workspaceRoot?: string };
    const dir = query.dir || '.';
    const resolved = resolveWorkspacePath(workspaceRootFrom(query), dir, { mustExist: true });
    if (pathKind(resolved.absolute) !== 'directory') {
      throw new Error(`Not a directory: ${resolved.relative}`);
    }
    const entries = await readdir(resolved.absolute, { withFileTypes: true });
    return {
      path: resolved.relative,
      entries: entries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory()
      }))
    };
  }));

  server.get('/git_status', withHttpErrors(async (request) =>
    gitMutex(async () => ({
      output: await gitStatus(workspaceRootFrom(request.query))
    }))
  ));

  server.get('/git_diff', withHttpErrors(async (request) => {
    const query = request.query as { args?: string | string[]; workspaceRoot?: string };
    const args = parseArgs(query.args);
    return gitMutex(async () => ({
      output: await gitDiff(workspaceRootFrom(query), args)
    }));
  }));

  server.post('/run_lint', withHttpErrors(async (request) =>
    verifyMutex(async () => ({
      output: await runLint(workspaceRootFrom(request.body))
    }))
  ));

  server.post('/run_tests', withHttpErrors(async (request) =>
    verifyMutex(async () => ({
      output: await runTests(workspaceRootFrom(request.body))
    }))
  ));

  server.post('/run_build', withHttpErrors(async (request) =>
    verifyMutex(async () => ({
      output: await runBuild(workspaceRootFrom(request.body))
    }))
  ));

  const webDist = resolveWebDist();
  if (existsSync(webDist)) {
    await server.register(fastifyStatic, {
      root: webDist,
      wildcard: false
    });

    server.setNotFoundHandler((request, reply) => {
      if (
        request.method !== 'GET' ||
        request.url.startsWith('/api/') ||
        request.url.startsWith('/read_') ||
        request.url.startsWith('/list_') ||
        request.url.startsWith('/git_') ||
        request.url.startsWith('/run_') ||
        request.url.startsWith('/write_') ||
        request.url.startsWith('/append_')
      ) {
        return reply.status(404).send({
          message: `Route ${request.method}:${request.url} not found`,
          error: 'Not Found',
          statusCode: 404
        });
      }
      return reply.sendFile('index.html');
    });
  }

  return server;
}

async function start() {
  const port = config.MCP_SERVER_PORT;
  const host = '127.0.0.1';
  const healthUrl = `${config.MCP_SERVER_URL}/health`;
  const state = await ensurePortAvailable(port, healthUrl);
  if (state === 'running') {
    process.exit(0);
  }

  const server = await buildServer();
  server.listen({ port, host }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const ui = existsSync(resolveWebDist());
    console.log(`MCP server listening on ${address}`);
    if (ui) {
      console.log(`Chat UI: ${config.MCP_SERVER_URL}`);
    }
  });
}

if (require.main === module) {
  start();
}