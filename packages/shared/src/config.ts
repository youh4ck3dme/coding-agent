import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { z } from 'zod';

function findProjectRoot(start: string): string | undefined {
  let dir = start;
  while (dir !== dirname(dir)) {
    if (
      existsSync(resolve(dir, '.env.local')) ||
      existsSync(resolve(dir, '.env')) ||
      existsSync(resolve(dir, '.env.example'))
    ) {
      return dir;
    }
    dir = dirname(dir);
  }
  return undefined;
}

function loadProjectEnv(start: string): void {
  const root = findProjectRoot(start);
  if (!root) {
    return;
  }

  const envFile = resolve(root, '.env');
  const envLocalFile = resolve(root, '.env.local');

  if (existsSync(envFile)) {
    loadDotenv({ path: envFile });
  }
  if (existsSync(envLocalFile)) {
    loadDotenv({ path: envLocalFile, override: true });
  }
}

loadProjectEnv(process.cwd());

const WorkspaceEnvBaseSchema = z.object({
  WORKSPACE_ROOT: z.string().default(process.cwd()),
  MCP_SERVER_PORT: z.coerce.number().int().positive().default(3000),
  MCP_SERVER_URL: z.string().url().optional()
});

function withMcpUrl<T extends z.infer<typeof WorkspaceEnvBaseSchema>>(data: T) {
  return {
    ...data,
    MCP_SERVER_URL: data.MCP_SERVER_URL ?? `http://127.0.0.1:${data.MCP_SERVER_PORT}`
  };
}

export const WorkspaceEnvSchema = WorkspaceEnvBaseSchema.transform(withMcpUrl);

export type WorkspaceEnvVars = z.infer<typeof WorkspaceEnvSchema>;

/**
 * Schema describing the environment variables consumed by Mistral-backed services.
 * The Mistral API key must be supplied by the user.
 */
export const EnvSchema = WorkspaceEnvBaseSchema.extend({
  MISTRAL_API_KEY: z.string().min(1, { message: 'MISTRAL_API_KEY is required' }),
  MISTRAL_MODEL: z.string().default('codestral-latest')
}).transform(withMcpUrl);

export type EnvVars = z.infer<typeof EnvSchema>;

function parseEnv<T extends z.ZodTypeAny>(schema: T, env: NodeJS.ProcessEnv): z.infer<T> {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment configuration', parsed.error.format());
    throw new Error('Invalid environment');
  }
  return parsed.data;
}

/**
 * Load workspace-only configuration for local tooling that does not call Mistral.
 */
export function loadWorkspaceConfig(env: NodeJS.ProcessEnv = process.env): WorkspaceEnvVars {
  return parseEnv(WorkspaceEnvSchema, env);
}

/**
 * Load and validate the full environment configuration.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): EnvVars {
  return parseEnv(EnvSchema, env);
}