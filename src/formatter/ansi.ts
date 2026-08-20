/**
 * @file src/formatter/ansi.ts
 * @description ANSI escape sequence stripper.
 *
 * Terminal tools emit colored ANSI escape sequences that confuse LLMs and break
 * JSON parsing. This utility cleanly strips ANSI color and cursor codes from strings.
 */

/**
 * Strips ANSI escape sequences and terminal control characters from strings.
 *
 * @param text Raw terminal string containing ANSI escape codes
 * @returns Clean text with all ANSI escape sequences removed
 */
export function stripAnsi(text: string): string {
  if (!text) return '';
  // Standard regular expression to match ANSI escape sequences (colors, cursor codes, etc.)
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiRegex, '');
}
