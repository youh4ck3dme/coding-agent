#!/usr/bin/env node
import { Command } from 'commander';
import { createInterface } from 'readline';
import { runAgent, extractAgentText } from '@coding-agent/agent-core';
import type { AgentContext, WriteApprovalDetails } from '@coding-agent/agent-core/dist/tools';
import { log } from '@coding-agent/shared/dist/logger';
import { agentRoles, type AgentRole } from '@coding-agent/shared/dist/types';

let autoApprove = false;

function formatApprovalPrompt(details: WriteApprovalDetails): string {
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

function cliApprovalHandler(): AgentContext['onApprove'] {
  return async (_action, details) => {
    if (autoApprove) {
      return true;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(resolve => {
      rl.question(formatApprovalPrompt(details), resolve);
    });
    rl.close();
    return /^y(es)?$/i.test(answer.trim());
  };
}

async function runCommand(
  mode: 'ask' | 'plan' | 'edit' | 'review',
  input: string,
  requireApproval = false,
  role?: AgentRole,
  options: { quiet?: boolean } = {}
) {
  const context: AgentContext = requireApproval
    ? { onApprove: cliApprovalHandler(), autoApprove }
    : {};
  const result = await runAgent(mode, input, context, role);
  const text = extractAgentText(result);
  if (!options.quiet && text) {
    console.log(text);
  }
  if (!options.quiet && result.toolCalls.length > 0) {
    log(`Tools used: ${result.toolCalls.map(call => call.name).join(', ')}`);
  }
  return { text, toolCalls: result.toolCalls, role, mode };
}

function isAgentRole(value: string): value is AgentRole {
  return agentRoles.includes(value as AgentRole);
}

const program = new Command();

program
  .name('coding-agent')
  .description('CLI for the coding agent')
  .version('0.1.0');

program
  .command('ask <question>')
  .description('Ask a question about the codebase')
  .action(async (question: string) => {
    await runCommand('ask', question);
  });

program
  .command('plan <task>')
  .description('Plan a code change before applying it')
  .action(async (task: string) => {
    await runCommand('plan', task);
  });

program
  .command('apply <task>')
  .description('Apply a code change with approval for file writes')
  .option('-y, --yes', 'Auto-approve file writes')
  .action(async (task: string, options: { yes?: boolean }) => {
    autoApprove = Boolean(options.yes);
    await runCommand('edit', task, true);
  });

program
  .command('agent <role> <task>')
  .description('Run one specialized agent: frontend, backend or qa')
  .action(async (role: string, task: string) => {
    if (!isAgentRole(role)) {
      throw new Error(`Unknown agent role "${role}". Use: ${agentRoles.join(', ')}`);
    }
    await runCommand(role === 'qa' ? 'review' : 'edit', task, role !== 'qa', role);
  });

program
  .command('parallel <task>')
  .description('Run frontend, backend and QA analysis concurrently')
  .action(async (task: string) => {
    const roles: Array<{ mode: 'plan' | 'review'; role: AgentRole }> = [
      { mode: 'plan', role: 'frontend' },
      { mode: 'plan', role: 'backend' },
      { mode: 'review', role: 'qa' }
    ];

    const runs = await Promise.all(
      roles.map(async ({ mode, role }) => {
        try {
          return await runCommand(mode, task, false, role, { quiet: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Agent run failed';
          return { text: `Chyba: ${message}`, toolCalls: [], role, mode };
        }
      })
    );

    for (const result of runs) {
      const label = result.role?.toUpperCase() ?? result.mode.toUpperCase();
      console.log(`\n=== ${label} ===\n`);
      console.log(result.text || '(Žiadna textová odpoveď)');
      if (result.toolCalls.length > 0) {
        log(`Tools (${label}): ${result.toolCalls.map(call => call.name).join(', ')}`);
      }
    }
  });

program.parseAsync(process.argv).catch(err => {
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error('Command failed');
  }
  process.exit(1);
});