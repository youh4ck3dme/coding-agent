import { AgentMode, AgentRole } from '@coding-agent/shared/dist/types';
import { buildUnifiedDiff } from './diff';
import { McpClient } from './mcp-client';
import {
  isPathAllowedForRole,
  roleScopeViolationMessage
} from './role-scope';

export type WriteApprovalDetails = {
  file: string;
  content: string;
  oldContent?: string;
  diff?: string;
  changeRatio?: number;
};

export type ApprovalHandler = (
  action: string,
  details: WriteApprovalDetails
) => Promise<boolean>;

export type AgentContext = {
  onApprove?: ApprovalHandler;
  autoApprove?: boolean;
  workspaceRoot?: string;
  role?: AgentRole;
};

type AgentTool = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const WORKSPACE_HINT =
  'Vždy používaj cesty relatívne ku koreňu aktuálne zvoleného workspace.';

const READ_TOOLS: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Workspace-relative file path' }
        },
        required: ['file']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and folders in a workspace directory.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Workspace-relative directory path' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show porcelain git status for the workspace.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show git diff. Optionally pass extra git diff arguments.',
      parameters: {
        type: 'object',
        properties: {
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional git diff arguments'
          }
        }
      }
    }
  }
];

const WRITE_TOOLS: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'append_file',
      description:
        'Append UTF-8 text to an existing file. Prefer this for comments, notes, or small additions.',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Workspace-relative file path' },
          content: { type: 'string', description: 'Text to append at end of file' }
        },
        required: ['file', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        'Replace entire file content. Use only when necessary. Read the file first and preserve unrelated content.',
      parameters: {
        type: 'object',
        properties: {
          file: { type: 'string', description: 'Workspace-relative file path' },
          content: { type: 'string', description: 'Full file content to write' }
        },
        required: ['file', 'content']
      }
    }
  }
];

const VERIFY_TOOLS: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'run_lint',
      description: 'Run the workspace lint script.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_tests',
      description: 'Run the workspace test script.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_build',
      description: 'Run the workspace build script.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

export function getToolsForMode(mode: AgentMode, role?: AgentRole): AgentTool[] {
  if (role === 'qa') {
    return [...READ_TOOLS];
  }

  switch (mode) {
    case 'ask':
    case 'plan':
    case 'review':
      return [...READ_TOOLS];
    case 'verify':
      return [...READ_TOOLS, ...VERIFY_TOOLS];
    case 'edit':
      return [...READ_TOOLS, ...WRITE_TOOLS, ...VERIFY_TOOLS];
    default:
      return [...READ_TOOLS];
  }
}

function assertWriteAllowed(file: string, context: AgentContext): { ok: false; error: string } | null {
  if (context.role === 'qa') {
    return { ok: false, error: 'QA rola nemôže zapisovať do súborov.' };
  }
  if (context.role && !isPathAllowedForRole(file, context.role)) {
    return { ok: false, error: roleScopeViolationMessage(file, context.role) };
  }
  return null;
}

export function workspaceSystemHint(): string {
  return WORKSPACE_HINT;
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function changeRatio(oldContent: string, newContent: string): number {
  const maxLength = Math.max(oldContent.length, newContent.length, 1);
  let diff = 0;
  const limit = Math.max(oldContent.length, newContent.length);
  for (let index = 0; index < limit; index++) {
    if (oldContent[index] !== newContent[index]) {
      diff++;
    }
  }
  return diff / maxLength;
}

async function requestWriteApproval(
  action: string,
  details: WriteApprovalDetails,
  context: AgentContext
): Promise<boolean> {
  if (context.autoApprove) {
    return true;
  }
  if (!context.onApprove) {
    return false;
  }
  return context.onApprove(action, details);
}

async function runTool<T>(action: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await action();
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Tool call failed' };
  }
}

export async function executeToolCall(
  name: string,
  argsJson: string,
  client: McpClient,
  context: AgentContext
): Promise<unknown> {
  const args = parseToolArgs(argsJson);

  switch (name) {
    case 'read_file':
      return runTool(() => client.readFile(String(args.file ?? '')));
    case 'list_directory':
      return runTool(() => client.listDirectory(String(args.dir ?? '.')));
    case 'git_status':
      return runTool(() => client.gitStatus());
    case 'git_diff':
      return runTool(() => client.gitDiff(Array.isArray(args.args) ? args.args.map(String) : []));
    case 'append_file': {
      const file = String(args.file ?? '');
      const content = String(args.content ?? '');
      const scopeError = assertWriteAllowed(file, context);
      if (scopeError) {
        return scopeError;
      }
      let oldContent = '';
      try {
        const existing = await client.readFile(file);
        oldContent = existing.data;
      } catch {
        return { ok: false, error: `Cannot append: file not found (${file})` };
      }
      const newContent = oldContent + content;
      const approved = await requestWriteApproval('append_file', {
        file,
        content,
        oldContent,
        diff: buildUnifiedDiff(file, oldContent, newContent),
        changeRatio: changeRatio(oldContent, newContent)
      }, context);
      if (!approved) {
        return { ok: false, error: 'Append rejected by user' };
      }
      return client.appendFile(file, content);
    }
    case 'write_file': {
      const file = String(args.file ?? '');
      const content = String(args.content ?? '');
      const scopeError = assertWriteAllowed(file, context);
      if (scopeError) {
        return scopeError;
      }
      let oldContent = '';
      try {
        const existing = await client.readFile(file);
        oldContent = existing.data;
      } catch {
        oldContent = '';
      }
      const ratio = changeRatio(oldContent, content);
      const approved = await requestWriteApproval('write_file', {
        file,
        content,
        oldContent,
        diff: buildUnifiedDiff(file, oldContent, content),
        changeRatio: ratio
      }, context);
      if (!approved) {
        return { ok: false, error: 'Write rejected by user' };
      }
      return client.writeFile(file, content);
    }
    case 'run_lint':
      return runTool(() => client.runLint());
    case 'run_tests':
      return runTool(() => client.runTests());
    case 'run_build':
      return runTool(() => client.runBuild());
    default:
      return { error: `Unknown tool: ${name}` };
  }
}