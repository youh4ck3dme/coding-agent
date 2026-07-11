import { sanitizeMessageContent } from '../lib/sanitizeMessage';

type MessageContentProps = {
  content: string;
};

/**
 * Renders chat text as plain escaped content — never uses dangerouslySetInnerHTML.
 */
export function MessageContent({ content }: MessageContentProps) {
  return <p className="whitespace-pre-wrap">{sanitizeMessageContent(content)}</p>;
}