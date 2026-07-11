/**
 * Represents a tool call requested by an agent.  The `name` field names the tool
 * (e.g. "read_file" or "write_file") and `args` contains the structured
 * arguments passed to that tool.  The shape of the arguments depends on the
 * specific tool implementation.
 */
export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

/**
 * Modes supported by the agent.  These map directly to the high level actions
 * the user can invoke from the CLI or the VS Code extension.
 */
export type AgentMode = 'ask' | 'plan' | 'edit' | 'verify' | 'review';

export const agentRoles = ['frontend', 'backend', 'qa'] as const;

export type AgentRole = (typeof agentRoles)[number];