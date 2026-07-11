import * as vscode from 'vscode';
import {
  runAgent,
  extractAgentText,
  AgentRunResult,
  AgentContext
} from '@coding-agent/agent-core';
import { AgentMode } from '@coding-agent/shared/dist/types';

let outputChannel: vscode.OutputChannel;

function showResult(mode: AgentMode, prompt: string, result: AgentRunResult) {
  const text = extractAgentText(result);
  outputChannel.clear();
  outputChannel.appendLine(`Mode: ${mode}`);
  outputChannel.appendLine(`Prompt: ${prompt}`);
  outputChannel.appendLine('');
  outputChannel.appendLine(text || '(No text response)');
  if (result.toolCalls.length > 0) {
    outputChannel.appendLine('');
    outputChannel.appendLine(`Tools used: ${result.toolCalls.map(call => call.name).join(', ')}`);
  }
  outputChannel.show(true);
}

async function promptInput(title: string): Promise<string | undefined> {
  return vscode.window.showInputBox({ prompt: title });
}

function vscodeApprovalHandler(): AgentContext['onApprove'] {
  return async (action, details) => {
    const file = String(details.file ?? 'unknown file');
    if (details.diff) {
      outputChannel.appendLine(`\n${action} preview for ${file}:`);
      outputChannel.appendLine(details.diff);
      outputChannel.show(true);
    }
    const ratio =
      details.changeRatio !== undefined
        ? ` (${(details.changeRatio * 100).toFixed(1)}% changed)`
        : '';
    const choice = await vscode.window.showWarningMessage(
      `Coding Agent wants to ${action} on ${file}${ratio}. Allow this change?`,
      { modal: true },
      'Allow',
      'Reject'
    );
    return choice === 'Allow';
  };
}

async function runMode(mode: AgentMode, title: string, requireApproval = false) {
  const input = await promptInput(title);
  if (!input) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Coding Agent (${mode})`,
      cancellable: false
    },
    async () => {
      try {
        const context: AgentContext = requireApproval ? { onApprove: vscodeApprovalHandler() } : {};
        const result = await runAgent(mode, input, context);
        showResult(mode, input, result);
        vscode.window.showInformationMessage(`Coding Agent (${mode}) finished.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        outputChannel.appendLine(`Error: ${message}`);
        outputChannel.show(true);
        vscode.window.showErrorMessage(`Coding Agent failed: ${message}`);
      }
    }
  );
}

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Coding Agent');

  context.subscriptions.push(
    outputChannel,
    vscode.commands.registerCommand('codingAgent.chat', () =>
      runMode('ask', 'Ask the coding agent a question')
    ),
    vscode.commands.registerCommand('codingAgent.plan', () =>
      runMode('plan', 'Describe the change you want to plan')
    ),
    vscode.commands.registerCommand('codingAgent.apply', () =>
      runMode('edit', 'Describe the change to apply', true)
    )
  );
}

export function deactivate() {
  outputChannel?.dispose();
}