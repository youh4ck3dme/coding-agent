import type { WriteApprovalDetails } from '@coding-agent/agent-core/dist/tools';
import { agentRoles, type AgentRole } from '@coding-agent/shared/dist/types';

export function formatApprovalPrompt(details: WriteApprovalDetails): string {
  const lines = [
    `\nProposed change: ${details.file}`,
    details.changeRatio !== undefined
      ? `Change ratio: ${(details.changeRatio * 100).toFixed(1)}%`
      : undefined,
    details.diff ? `\n${details.diff}\n` : undefined,
    'Approve this change? (y/N) '
  ];
  return lines.filter(Boolean).join('\n');
}

export function isAgentRole(value: string): value is AgentRole {
  return agentRoles.includes(value as AgentRole);
}

export function isApprovalAnswer(answer: string): boolean {
  return /^y(es)?$/i.test(answer.trim());
}