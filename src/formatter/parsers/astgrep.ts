/**
 * @file src/formatter/parsers/astgrep.ts
 * @description Parses ast-grep (sg scan) findings into standardized LSP DiagnosticItems.
 */

import type { DiagnosticItem, DiagnosticSeverity } from '../../types/index.js';

/**
 * Parse ast-grep output (JSON or line-based) into standardized LSP diagnostic items.
 *
 * @param output Raw terminal stdout/stderr from ast-grep / sg
 * @returns Array of DiagnosticItem objects
 */
export function parseAstGrepOutput(output: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];

  // Attempt JSON parsing first (ast-grep --json)
  if (output.trim().startsWith('[') || output.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item.file && item.ruleId) {
          diagnostics.push({
            source: 'ast-grep',
            rule_id: item.ruleId,
            severity: (item.severity || 'ERROR').toUpperCase() as DiagnosticSeverity,
            file_path: item.file,
            range: item.range
              ? {
                  start: { line: item.range.start?.line || 1, column: item.range.start?.column || 1 },
                  end: { line: item.range.end?.line || 1, column: item.range.end?.column || 80 },
                }
              : undefined,
            error_message: item.message || `ast-grep rule violation: ${item.ruleId}`,
            repair_instruction: {
              action: 'REWRITE_BLOCK',
              description: `Fix AST pattern violation: ${item.ruleId}`,
              repair_tokens: item.replacement ? [item.replacement] : [`# Fix for ${item.ruleId}`],
            },
          });
        }
      }
      if (diagnostics.length > 0) return diagnostics;
    } catch {}
  }

  // Fallback to line-based parsing: path/to/file.ts:line:col: [rule-id] message
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^([^:]+):(\d+):(\d+):\s*\[?([a-zA-Z0-9_-]+)\]?\s*(.*)$/);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId, msg] = match;
      const lineNum = parseInt(lineStr, 10) || 1;
      const colNum = parseInt(colStr, 10) || 1;

      diagnostics.push({
        source: 'ast-grep',
        rule_id: ruleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 30 },
        },
        error_message: msg || `AST pattern violation: ${ruleId}`,
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: `Fix AST pattern violation: ${ruleId}`,
          repair_tokens: [`# Rewrite AST pattern matching ${ruleId}`],
        },
      });
    }
  }

  return diagnostics;
}
