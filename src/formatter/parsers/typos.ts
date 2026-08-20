import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseTyposOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  const lines = clean.split('\n');
  let pendingTypo: { typo: string; correction: string } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern 1: error: `foo` should be `bar`
    const typoMatch = line.match(/error:\s*`([^`]+)`\s*should be\s*`([^`]+)`/i);
    if (typoMatch) {
      pendingTypo = { typo: typoMatch[1], correction: typoMatch[2] };
      continue;
    }

    // Pattern 2: --> path/to/file:line:col
    const locMatch = line.match(/-->\s*([^\s:]+):(\d+):(\d+)/);
    if (locMatch && pendingTypo) {
      const [, filePath, lineStr, colStr] = locMatch;
      const lineNum = parseInt(lineStr, 10);
      const colNum = parseInt(colStr, 10);

      diagnostics.push({
        source: 'typos',
        rule_id: 'TYPO_DETECTED',
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + pendingTypo.typo.length },
        },
        code_snippet: pendingTypo.typo,
        error_message: `Typo detected: \`${pendingTypo.typo}\` should be \`${pendingTypo.correction}\`.`,
        repair_instruction: {
          action: 'REPLACE_TOKEN',
          description: `Replace typo \`${pendingTypo.typo}\` with correct spelling \`${pendingTypo.correction}\`.`,
          repair_tokens: [pendingTypo.correction],
        },
      });
      pendingTypo = null;
      continue;
    }

    // Single-line pattern: path/to/file:line:col: `foo` should be `bar`
    const singleMatch = line.match(/^([^\s:]+):(\d+):(\d+):\s*(?:error:\s*)?`([^`]+)`\s*should be\s*`([^`]+)`/i);
    if (singleMatch) {
      const [, filePath, lineStr, colStr, typo, correction] = singleMatch;
      const lineNum = parseInt(lineStr, 10);
      const colNum = parseInt(colStr, 10);

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
    }
  }

  return diagnostics;
}
