import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseGenericOutput(rawOutput: string, sourceName: string = 'gate'): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  const lines = clean.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches standard Unix error formats:
    // path/to/file.ext:10:5: error message
    // path/to/file.ext:10: error message
    const match = trimmed.match(/^([^\s:]+\.[a-zA-Z0-9_-]+):(\d+)(?::(\d+))?:\s*(?:([a-zA-Z0-9_\-\/]+):)?\s*(.*)$/);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId, msg] = match;
      const lineNum = parseInt(lineStr, 10);
      const colNum = colStr ? parseInt(colStr, 10) : 1;

      diagnostics.push({
        source: sourceName,
        rule_id: ruleId || `${sourceName.toUpperCase()}_ERROR`,
        severity: msg.toLowerCase().includes('warning') ? 'WARNING' : 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 20 },
        },
        error_message: msg.trim() || 'Tool validation failed',
        repair_instruction: {
          action: 'MANUAL_FIX',
          description: `Fix the issue reported by ${sourceName}.`,
          repair_tokens: [`// Resolve ${ruleId || 'error'} in ${filePath}`],
        },
      });
    }
  }

  const lower = clean.toLowerCase();
  const isSuccessMessage =
    lower.includes('no errors') ||
    lower.includes('0 errors') ||
    lower.includes('passed') ||
    lower.includes('checked') ||
    lower.includes('success');

  if (diagnostics.length === 0 && clean.trim().length > 0 && !isSuccessMessage) {
    // If no line-based match was found, emit a general gate diagnostic
    diagnostics.push({
      source: sourceName,
      rule_id: `${sourceName.toUpperCase()}_GATE_FAILURE`,
      severity: 'ERROR',
      file_path: 'workspace',
      error_message: clean.trim().slice(0, 500),
      repair_instruction: {
        action: 'MANUAL_FIX',
        description: `Review output from ${sourceName} and fix failing constraints.`,
        repair_tokens: ['// Check error output and resolve failing check'],
      },
    });
  }

  return diagnostics;
}
