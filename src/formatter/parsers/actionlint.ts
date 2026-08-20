import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseActionlintOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  const lines = clean.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: .github/workflows/ci.yml:15:3: message [rule-name]
    const match = trimmed.match(/^([^\s:]+\.ya?ml):(\d+):(\d+):\s*(.*?)(?:\s*\[([^\]]+)\])?$/);
    if (match) {
      const [, filePath, lineStr, colStr, msg, rule] = match;
      const lineNum = parseInt(lineStr, 10);
      const colNum = parseInt(colStr, 10);
      const ruleId = rule ? `ACTIONLINT_${rule.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}` : 'ACTIONLINT_SYNTAX_ERROR';

      diagnostics.push({
        source: 'actionlint',
        rule_id: ruleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 20 },
        },
        error_message: msg.trim() || 'GitHub Actions workflow validation error',
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: 'Fix the GitHub Actions workflow syntax error according to official GitHub Actions schema.',
          repair_tokens: [
            '# Check workflow syntax against GitHub Actions schema documentation',
          ],
        },
      });
    }
  }

  return diagnostics;
}
