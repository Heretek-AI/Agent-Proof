/**
 * @file src/formatter/parsers/ruff.ts
 * @description Ruff output parser for Python linter and formatter diagnostics.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw stdout/stderr from `ruff check` into structured DiagnosticItems.
 * Supports both Ruff JSON output and standard concise CLI text output.
 *
 * @param rawOutput Raw terminal output from Ruff
 * @returns Array of DiagnosticItem objects with rule codes (e.g. F401, E722) and repair instructions
 */
export function parseRuffOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // 1. Check if output is Ruff JSON format
  if (clean.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const filePath = item.filename || 'unknown';
          const line = item.location?.row || 1;
          const col = item.location?.column || 1;
          const endLine = item.end_location?.row || line;
          const endCol = item.end_location?.column || col + 10;
          const ruleId = item.code || 'RUFF_ERROR';
          const message = item.message || 'Python lint violation';

          diagnostics.push({
            source: 'ruff',
            rule_id: ruleId,
            severity: 'ERROR',
            file_path: filePath,
            range: {
              start: { line, column: col },
              end: { line: endLine, column: endCol },
            },
            error_message: message,
            repair_instruction: generateRuffRepair(ruleId, message, filePath),
          });
        }
        if (diagnostics.length > 0) return diagnostics;
      }
    } catch {
      // Continue to regex parser if JSON parse fails
    }
  }

  // 2. Regex parser for Ruff standard text output: filePath:line:col: RULE [*] message
  const lines = clean.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern: api/server.py:2:1: F401 [*] 'sys' imported but unused
    const match = trimmed.match(/^([^\s:]+):(\d+):(\d+):\s*([A-Z0-9]+)\s*(?:\[\*\])?\s*(.*)$/);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId, message] = match;
      diagnostics.push({
        source: 'ruff',
        rule_id: ruleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + 10 },
        },
        error_message: message.trim(),
        repair_instruction: generateRuffRepair(ruleId, message.trim(), filePath),
      });
    }
  }

  return diagnostics;
}

/**
 * Generate actionable repair instructions and replacement tokens for Ruff rules
 */
function generateRuffRepair(ruleId: string, message: string, filePath: string): DiagnosticItem['repair_instruction'] {
  // F401: Unused import
  if (ruleId === 'F401') {
    return {
      action: 'DELETE_LINE',
      description: 'Remove unused import statement.',
      repair_tokens: ['# Remove unused import'],
      suggested_command: `ruff check --fix ${filePath}`,
    };
  }

  // E722: Do not use bare 'except'
  if (ruleId === 'E722' || message.toLowerCase().includes('bare')) {
    return {
      action: 'REWRITE_BLOCK',
      description: 'Do not use bare `except:`. Specify explicit exception type (e.g. `except Exception as e:`).',
      repair_tokens: [
        'except Exception as err:',
        '    logger.error(f"Operation failed: {err}")',
        '    raise',
      ],
      suggested_command: `ruff check --fix ${filePath}`,
    };
  }

  // B006: Do not use mutable data structures for argument defaults
  if (ruleId === 'B006') {
    return {
      action: 'REPLACE_TOKEN',
      description: 'Replace mutable argument default (e.g. `arg=[]`) with `None` and initialize in function body.',
      repair_tokens: ['arg: list | None = None', 'if arg is None: arg = []'],
    };
  }

  // General auto-fixable Ruff rule
  return {
    action: 'EXECUTE_COMMAND',
    description: `Apply Ruff automated fix: ruff check --fix ${filePath}`,
    repair_tokens: [`ruff check --fix ${filePath}`],
    suggested_command: `ruff check --fix ${filePath}`,
  };
}
