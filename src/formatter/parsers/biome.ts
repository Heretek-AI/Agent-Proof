import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseBiomeOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // Check if JSON output
  if (clean.trim().startsWith('{')) {
    try {
      const data = JSON.parse(clean);
      if (data.diagnostics && Array.isArray(data.diagnostics)) {
        for (const diag of data.diagnostics) {
          const filePath = diag.location?.path?.file || 'unknown';
          const startLine = diag.location?.span?.start?.line || 1;
          const startCol = diag.location?.span?.start?.column || 1;
          const endLine = diag.location?.span?.end?.line || startLine;
          const endCol = diag.location?.span?.end?.column || startCol;
          const ruleId = diag.category || 'biome/lint';
          const message = diag.description || diag.message || 'Biome lint violation';

          diagnostics.push({
            source: 'biome',
            rule_id: ruleId,
            severity: diag.severity === 'warning' ? 'WARNING' : 'ERROR',
            file_path: filePath,
            range: {
              start: { line: startLine, column: startCol },
              end: { line: endLine, column: endCol },
            },
            error_message: message,
            repair_instruction: generateBiomeRepair(ruleId, message),
          });
        }
        if (diagnostics.length > 0) return diagnostics;
      }
    } catch {
      // Continue to regex
    }
  }

  // Regex parsing for Biome text output
  // Example:
  // src/index.ts:12:5 lint/suspicious/noExplicitAny ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //   ✖ Avoid using any.
  const lines = clean.split('\n');
  let currentDiag: Partial<DiagnosticItem> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^([^\s:]+):(\d+):(\d+)\s+([a-zA-Z0-9_\-\/]+)/);
    if (headerMatch) {
      if (currentDiag && currentDiag.file_path) {
        diagnostics.push(currentDiag as DiagnosticItem);
      }

      const [, filePath, lineStr, colStr, ruleId] = headerMatch;
      const lineNum = parseInt(lineStr, 10);
      const colNum = parseInt(colStr, 10);

      currentDiag = {
        source: 'biome',
        rule_id: ruleId,
        severity: ruleId.includes('warn') ? 'WARNING' : 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 10 },
        },
        error_message: '',
      };
      continue;
    }

    if (currentDiag && (line.includes('✖') || line.includes('error:') || line.includes('warn:'))) {
      const msg = line.replace(/^[✖\s]+/, '').trim();
      currentDiag.error_message = msg;
      currentDiag.repair_instruction = generateBiomeRepair(currentDiag.rule_id || '', msg);
    }
  }

  if (currentDiag && currentDiag.file_path) {
    if (!currentDiag.error_message) currentDiag.error_message = 'Biome lint or format violation';
    if (!currentDiag.repair_instruction) currentDiag.repair_instruction = generateBiomeRepair(currentDiag.rule_id || '');
    diagnostics.push(currentDiag as DiagnosticItem);
  }

  return diagnostics;
}

function generateBiomeRepair(ruleId: string, message: string = ''): DiagnosticItem['repair_instruction'] {
  if (ruleId.includes('noExplicitAny')) {
    return {
      action: 'REPLACE_TOKEN',
      description: 'Replace `any` with `unknown` or a specific typed interface.',
      repair_tokens: ['unknown', 'Record<string, unknown>'],
    };
  }

  if (ruleId.includes('noUnusedVariables') || ruleId.includes('noUnusedImports')) {
    return {
      action: 'DELETE_LINE',
      description: 'Remove unused variable or import.',
      repair_tokens: ['// Remove unused identifier'],
    };
  }

  if (ruleId.includes('useConst')) {
    return {
      action: 'REPLACE_TOKEN',
      description: 'Use `const` instead of `let` or `var` for variables that are never reassigned.',
      repair_tokens: ['const '],
    };
  }

  return {
    action: 'EXECUTE_COMMAND',
    description: `Run biome check --write to automatically apply safe fixes.`,
    suggested_command: 'npx biome check --write ${filePath}',
    repair_tokens: ['npx biome check --write'],
  };
}
