/**
 * @file src/formatter/parsers/actionlint.ts
 * @description Actionlint output parser for GitHub Actions workflow syntax validation.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw stdout/stderr from `actionlint` into structured DiagnosticItems.
 *
 * @param rawOutput Raw terminal output from actionlint
 * @returns Array of DiagnosticItem objects with workflow repair instructions
 */
export function parseActionlintOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];
  const lines = clean.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: .github/workflows/ci.yml:12:7: message [rule-id]
    const match = trimmed.match(/^([^\s:]+):(\d+):(\d+):\s*(.*?)(?:\s*\[([^\]]+)\])?$/);
    if (match) {
      const [, filePath, lineStr, colStr, message, ruleId] = match;
      const effectiveRuleId = ruleId || 'ACTIONLINT_SYNTAX_ERROR';
      diagnostics.push({
        source: 'actionlint',
        rule_id: effectiveRuleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + 20 },
        },
        error_message: message.trim(),
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: `Fix GitHub Actions workflow syntax error: ${message.trim()}`,
          repair_tokens: [`# Correct workflow step syntax in ${filePath}`],
        },
      });
    }
  }

  return diagnostics;
}
