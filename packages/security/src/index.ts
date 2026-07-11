/**
 * Redact secrets from a string.  This is a naive implementation that looks for
 * common patterns such as api_key=XXXXX and replaces the value with
 * [REDACTED].  More sophisticated implementations should use configurable
 * regular expressions and support multiple secret formats.
 */
export function redactSecrets(input: string): string {
  return input.replace(/(api[_-]?key=)([^&\s]+)/gi, '$1[REDACTED]');
}

/**
 * Determine whether a given absolute path is within the allowed workspace root.
 * This prevents path traversal attacks by ensuring that tools only access
 * resources under the configured root directory.
 */
export function isPathAllowed(root: string, fullPath: string): boolean {
  return fullPath.startsWith(root);
}