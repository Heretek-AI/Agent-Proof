/**
 * @file src/formatter/parsers/typos.ts
 * @description Typos output parser for AST-aware source code spell checking.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw stdout/stderr from `typos` into structured DiagnosticItems.
 *
 * @param rawOutput Raw terminal output from typos CLI
 * @returns Array of DiagnosticItem objects with accurate spelling repair tokens
 */
export function parseTyposOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern 1: error: `typo` should be `correction`
    //            --> filePath:line:col
    const match1 = line.match(/error:\s*`([^`]+)`\s+should be\s+`([^`]+)`/);
    if (match1) {
      const [, typo, correction] = match1;
      let filePath = 'unknown';
      let lineNum = 1;
      let colNum = 1;

      // Look at next lines for file location indicator: --> filePath:line:col
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const locMatch = nextLine.match(/-->\s*([^\s:]+):(\d+):(\d+)/);
        if (locMatch) {
          filePath = locMatch[1];
          lineNum = parseInt(locMatch[2], 10);
          colNum = parseInt(locMatch[3], 10);
          i++; // Skip location line
        }
      }

      diagnostics.push({
        source: 'typos',
        rule_id: 'TYPO_DETECTED',
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + typo.length },
        },
        code_snippet: typo,
        error_message: `Typo detected: \`${typo}\` should be \`${correction}\`.`,
        repair_instruction: {
          action: 'REPLACE_TOKEN',
          description: `Replace typo \`${typo}\` with correct spelling \`${correction}\`.`,
          repair_tokens: [correction],
        },
      });
      continue;
    }

    // Pattern 2: filePath:line:col: `typo` -> `correction`
    const match2 = line.match(/^([^\s:]+):(\d+):(\d+):\s*`([^`]+)`\s*->\s*`([^`]+)`/);
    if (match2) {
      const [, filePath, lineStr, colStr, typo, correction] = match2;
      diagnostics.push({
        source: 'typos',
        rule_id: 'TYPO_DETECTED',
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + typo.length },
        },
        code_snippet: typo,
        error_message: `Typo: \`${typo}\` -> \`${correction}\``,
        repair_instruction: {
          action: 'REPLACE_TOKEN',
          description: `Fix typo: replace with \`${correction}\``,
          repair_tokens: [correction],
        },
      });
    }
  }

  return diagnostics;
}
