import { withMcpConcurrency } from './mcp-queue';

export class McpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly workspaceRoot?: string
  ) {}

  private withWorkspaceQuery(query?: Record<string, string>): Record<string, string> | undefined {
    if (!this.workspaceRoot) {
      return query;
    }
    return { ...query, workspaceRoot: this.workspaceRoot };
  }

  private withWorkspaceBody(body?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!this.workspaceRoot) {
      return body;
    }
    return { ...body, workspaceRoot: this.workspaceRoot };
  }

  private async request<T>(
    path: string,
    init?: { method?: string; query?: Record<string, string>; body?: unknown }
  ): Promise<T> {
    return withMcpConcurrency(async () => {
      const url = new URL(path, this.baseUrl);
      if (init?.query) {
        for (const [key, value] of Object.entries(init.query)) {
          url.searchParams.set(key, value);
        }
      }

      const response = await fetch(url, {
        method: init?.method ?? 'GET',
        headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
        body: init?.body ? JSON.stringify(init.body) : undefined
      });

      const payload = await response.json();
      if (!response.ok) {
        const message = (payload as { error?: string }).error || response.statusText;
        throw new Error(`MCP ${path} failed (${response.status}): ${message}`);
      }
      return payload as T;
    });
  }

  readFile(file: string) {
    return this.request<{ data: string; path: string }>('/read_file', {
      query: this.withWorkspaceQuery({ file })
    });
  }

  listDirectory(dir = '.') {
    return this.request<{
      path: string;
      entries: Array<{ name: string; isDirectory: boolean }>;
    }>('/list_directory', {
      query: this.withWorkspaceQuery({ dir })
    });
  }

  gitStatus() {
    return this.request<{ output: string }>('/git_status', {
      query: this.withWorkspaceQuery()
    });
  }

  gitDiff(args: string[] = []) {
    return this.request<{ output: string }>('/git_diff', {
      query: this.withWorkspaceQuery(args.length ? { args: args.join(' ') } : undefined)
    });
  }

  writeFile(file: string, content: string) {
    return this.request<{ ok: boolean; path: string }>('/write_file', {
      method: 'POST',
      body: this.withWorkspaceBody({ file, content })
    });
  }

  appendFile(file: string, content: string) {
    return this.request<{ ok: boolean; path: string }>('/append_file', {
      method: 'POST',
      body: this.withWorkspaceBody({ file, content })
    });
  }

  runLint() {
    return this.request<{ output: string }>('/run_lint', {
      method: 'POST',
      body: this.withWorkspaceBody()
    });
  }

  runTests() {
    return this.request<{ output: string }>('/run_tests', {
      method: 'POST',
      body: this.withWorkspaceBody()
    });
  }

  runBuild() {
    return this.request<{ output: string }>('/run_build', {
      method: 'POST',
      body: this.withWorkspaceBody()
    });
  }
}