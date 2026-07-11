import { loadConfig } from '@coding-agent/shared/dist/config';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

type MistralErrorBody = {
  message?: string;
  type?: string;
  code?: string;
};

function formatMistralError(status: number, body: MistralErrorBody): Error {
  const message = body.message || body.code || 'Mistral request failed';
  return new Error(`Mistral request failed (${status}): ${message}`);
}

/**
 * Execute a chat completion using the Mistral API.
 * Supports optional tool definitions for function calling.
 */
export async function chatCompletion(messages: unknown[], tools?: unknown[]) {
  const config = loadConfig();
  const request: Record<string, unknown> = {
    model: config.MISTRAL_MODEL,
    messages
  };

  if (tools && tools.length > 0) {
    request.tools = tools;
    request.tool_choice = 'auto';
  }

  const response = await fetch(MISTRAL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.MISTRAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw formatMistralError(response.status, payload as MistralErrorBody);
  }

  return payload;
}