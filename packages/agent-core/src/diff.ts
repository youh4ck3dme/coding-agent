export function buildUnifiedDiff(
  file: string,
  oldContent: string,
  newContent: string,
  maxLines = 40
): string {
  if (oldContent === newContent) {
    return `(no changes in ${file})`;
  }

  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const lines: string[] = [`--- ${file}`, `+++ ${file}`];

  const limit = Math.min(Math.max(oldLines.length, newLines.length), maxLines);
  for (let index = 0; index < limit; index++) {
    const before = oldLines[index];
    const after = newLines[index];
    if (before === after) {
      continue;
    }
    if (before !== undefined) {
      lines.push(`- ${before}`);
    }
    if (after !== undefined) {
      lines.push(`+ ${after}`);
    }
  }

  if (lines.length === 2) {
    lines.push('- (content replaced)');
    lines.push(`+ (${newLines.length} lines total)`);
  }

  return lines.join('\n');
}