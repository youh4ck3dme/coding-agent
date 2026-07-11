import { chatCompletion } from '@coding-agent/mistral-client';
import { loadConfig } from '@coding-agent/shared/dist/config';
import { log } from '@coding-agent/shared/dist/logger';
import { AgentMode, AgentRole } from '@coding-agent/shared/dist/types';
import { McpClient } from './mcp-client';
import { buildSystemPrompt } from './prompts';
import { AgentContext, executeToolCall, getToolsForMode } from './tools';

export type { AgentContext, ApprovalHandler } from './tools';

const MAX_TOOL_ROUNDS = 8;

export type AgentRunResult = {
  text: string;
  toolCalls: Array<{ name: string; result: unknown }>;
  raw: unknown;
};

type ChatMessage = Record<string, unknown>;

type ParsedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

const KNOWN_TOOLS = new Set([
  'read_file',
  'list_directory',
  'git_status',
  'git_diff',
  'append_file',
  'write_file',
  'run_lint',
  'run_tests',
  'run_build'
]);

function extractToolCalls(message: Record<string, unknown>): ParsedToolCall[] {
  const toolCalls = message.tool_calls;
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    return toolCalls
      .map((call, index) => {
        const fn = (call as { function?: { name?: string; arguments?: string } }).function ?? {};
        return {
          id: String((call as { id?: string }).id ?? `tool_call_${index}`),
          name: String(fn.name ?? ''),
          arguments: String(fn.arguments ?? '{}')
        };
      })
      .filter(call => KNOWN_TOOLS.has(call.name));
  }

  const functionCall = message.function_call as { name?: string; arguments?: string } | undefined;
  if (functionCall?.name) {
    return [{
      id: 'function_call',
      name: functionCall.name,
      arguments: String(functionCall.arguments ?? '{}')
    }];
  }

  return [];
}

export function extractAgentText(result: AgentRunResult | unknown): string {
  if (result && typeof result === 'object' && 'text' in result) {
    return String((result as AgentRunResult).text || '');
  }

  const raw = result as { choices?: Array<{ message?: { content?: string | null } }> };
  return raw?.choices?.[0]?.message?.content ?? '';
}

export async function runAgent(
  mode: AgentMode,
  input: string,
  context: AgentContext = {},
  role?: AgentRole
): Promise<AgentRunResult> {
  const config = loadConfig();
  const agentContext: AgentContext = { ...context, role };
  const mcp = new McpClient(config.MCP_SERVER_URL, agentContext.workspaceRoot);
  const tools = getToolsForMode(mode, role);
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(mode, role) },
    { role: 'user', content: input }
  ];
  const executedTools: Array<{ name: string; result: unknown }> = [];
  let lastRaw: unknown;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    lastRaw = await chatCompletion(messages, tools);
    const choice = (lastRaw as { choices?: Array<{ message?: Record<string, unknown> }> }).choices?.[0];
    const assistantMessage = choice?.message;
    if (!assistantMessage) {
      break;
    }

    messages.push(assistantMessage);
    const toolCalls = extractToolCalls(assistantMessage);
    if (toolCalls.length === 0) {
      return {
        text: String(assistantMessage.content ?? ''),
        toolCalls: executedTools,
        raw: lastRaw
      };
    }

    const toolResultCache = new Map<string, unknown>();

    for (const call of toolCalls) {
      const cacheKey = `${call.name}:${call.arguments}`;
      log(`Agent tool call (${mode}):`, call.name, call.arguments);

      let result = toolResultCache.get(cacheKey);
      if (!result) {
        result = await executeToolCall(call.name, call.arguments, mcp, agentContext);
        toolResultCache.set(cacheKey, result);
        executedTools.push({ name: call.name, result });
      }
      if (
        result &&
        typeof result === 'object' &&
        'error' in result &&
        !('ok' in result)
      ) {
        log(`Tool error (${call.name}):`, (result as { error: string }).error);
      }
      messages.push({
        role: 'tool',
        name: call.name,
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
    }
  }

  return {
    text: '',
    toolCalls: executedTools,
    raw: lastRaw
  };
}