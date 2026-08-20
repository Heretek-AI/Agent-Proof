/**
 * @file src/formatter/parsers/generic.ts
 * @description Fallback generic output parser for unrecognized tools and standard error streams.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse arbitrary tool error output into structured DiagnosticItems using standard heuristics.
 *
 * @param rawOutput Raw error string from an unclassified tool
 * @param toolName Name of the tool producing the output
 * @returns Array of DiagnosticItem objects
 */
export function parseGenericOutput(rawOutput: string, toolName: string = 'unknown'): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];
  const lines = clean.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: filePath:line:col: message
    const match1 = trimmed.match(/^([^\s:]+):(\d+):(\d+):\s*(.*)$/);
    if (match1) {
      const [, filePath, lineStr, colStr, message] = match1;
      diagnostics.push({
        source: toolName,
        rule_id: `${toolName.toUpperCase()}_ERROR`,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + 20 },
        },
        error_message: message.trim(),
        repair_instruction: {
          action: 'MANUAL_FIX',
          description: `Resolve ${toolName} violation in ${filePath}`,
          repair_tokens: [`# Fix violation reported by ${toolName}`],
        },
      });
      continue;
    }

    // Pattern 2: Generic error line
    if (trimmed.toLowerCase().includes('error') || trimmed.toLowerCase().includes('failed')) {
      diagnostics.push({
        source: toolName,
        rule_id: `${toolName.toUpperCase()}_FAILURE`,
        severity: 'ERROR',
        file_path: 'codebase',
        error_message: trimmed,
        repair_instruction: {
          action: 'MANUAL_FIX',
          description: `Resolve error reported by ${toolName}`,
          repair_tokens: [`# Resolve ${toolName} failure: ${trimmed}`],
        },
      });
    }
  }

  // If no specific lines matched but rawOutput is non-empty, emit a single diagnostic item
  if (diagnostics.length === 0 && clean.trim().length > 0) {
    diagnostics.push({
      source: toolName,
      rule_id: `${toolName.toUpperCase()}_ERROR`,
      severity: 'ERROR',
      file_path: 'codebase',
      error_message: clean.trim().split('\n')[0] || `${toolName} execution failed`,
      repair_instruction: {
        action: 'MANUAL_FIX',
        description: `Investigate and resolve ${toolName} failure.`,
        repair_tokens: [`# Fix ${toolName} failure`],
      },
    });
  }

  return diagnostics;
}
