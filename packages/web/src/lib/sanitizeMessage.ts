const SCRIPT_BLOCK = /<script[\s\S]*?<\/script>/gi;
const HTML_TAG = /<\/?[a-z][\s\S]*?>/gi;

/**
 * Strips HTML tags from chat content. React text nodes already escape output;
 * this is defense-in-depth against pasted or agent-generated markup.
 */
export function sanitizeMessageContent(content: string): string {
  return content.replace(SCRIPT_BLOCK, '').replace(HTML_TAG, '');
}