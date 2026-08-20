/**
 * Strips ANSI escape sequences and terminal control characters from strings.
 */
export function stripAnsi(text: string): string {
  if (!text) return '';
  // Standard regular expression to match ANSI escape sequences (colors, cursor codes, etc.)
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiRegex, '');
}
