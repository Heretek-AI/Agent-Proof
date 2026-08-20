/**
 * @file src/formatter/parsers/biome.ts
 * @description Biome output parser for JS/TS linter and formatter diagnostics.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw stdout/stderr from `biome check` into structured DiagnosticItems.
 * Supports both Biome JSON output and human-readable CLI terminal diagnostics.
 *
 * @param rawOutput Raw terminal output from Biome
 * @returns Array of DiagnosticItem objects with rule IDs and repair tokens
 */
export function parseBiomeOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // 1. Check if output is Biome JSON format
  if (clean.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed.diagnostics && Array.isArray(parsed.diagnostics)) {
        for (const diag of parsed.diagnostics) {
          const filePath = diag.location?.path?.file || 'unknown';
          const line = diag.location?.span?.[0] ? 1 : (diag.location?.start?.line || 1);
          const col = diag.location?.start?.column || 1;
          const ruleId = diag.category || 'biome-lint';
          const message = diag.description || (diag.message && diag.message[0]?.text) || 'Biome lint violation';
          const severity = diag.severity === 'error' || diag.severity === 'fatal' ? 'ERROR' : 'WARNING';

          diagnostics.push({
            source: 'biome',
            rule_id: ruleId,
            severity,
            file_path: filePath,
            range: {
              start: { line, column: col },
              end: { line, column: col + 20 },
            },
            error_message: message,
            repair_instruction: generateBiomeRepair(ruleId, filePath),
          });
        }
        if (diagnostics.length > 0) return diagnostics;
      }
    } catch {
      // Continue to regex parser if JSON parsing fails
    }
  }

  // 2. Regex parser for Biome standard CLI terminal output
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern: filePath:line:col lint/suspicious/noExplicitAny ━━━━━━━━━━━━━
    const match = line.match(/^([^\s:]+):(\d+):(\d+)\s+([a-zA-Z0-9_\-\/]+)/);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId] = match;
      let errorMsg = 'Biome lint violation';

      // Look ahead for the error description on subsequent lines
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('✖') || nextLine.startsWith('!') || nextLine.startsWith('i')) {
          errorMsg = nextLine.replace(/^[✖!i]\s*/, '').trim();
          break;
        }
      }

      diagnostics.push({
        source: 'biome',
        rule_id: ruleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + 20 },
        },
        error_message: errorMsg,
        repair_instruction: generateBiomeRepair(ruleId, filePath),
      });
    }
  }

  return diagnostics;
}

/**
 * Generate actionable repair instructions for Biome rules
 */
function generateBiomeRepair(ruleId: string, filePath: string): DiagnosticItem['repair_instruction'] {
  if (ruleId.includes('noExplicitAny')) {
    return {
      action: 'REPLACE_TOKEN',
      description: 'Replace `any` with `unknown` or a specific TypeScript interface / type guard.',
      repair_tokens: ['unknown', 'type SafePayload = Record<string, unknown>;'],
      suggested_command: `npx @biomejs/biome check --write ${filePath}`,
    };
  }

  return {
    action: 'EXECUTE_COMMAND',
    description: `Run Biome automated fix or format: npx @biomejs/biome check --write ${filePath}`,
    repair_tokens: [`npx @biomejs/biome check --write ${filePath}`],
    suggested_command: `npx @biomejs/biome check --write ${filePath}`,
  };
}
