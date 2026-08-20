/**
 * @file src/formatter/parsers/aislop.ts
 * @description AISlop output parser for deterministic AI code smells and slop detection.
 *
 * Extracts violations for swallowed errors, empty catch blocks, hallucinated imports,
 * dead code, and unsafe type casts, and generates actionable repair tokens for LLMs.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw output from the `aislop` CLI tool into structured DiagnosticItems.
 * Supports both JSON payload formats and standard CLI text output.
 *
 * @param rawOutput Raw stdout/stderr string from aislop
 * @returns Array of DiagnosticItem objects with rule IDs and repair instructions
 */
export function parseAislopOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // 1. Check if output is JSON
  if (clean.trim().startsWith('{') || clean.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(clean);
      const items = Array.isArray(parsed) ? parsed : (parsed.issues || parsed.diagnostics || [parsed]);
      for (const item of items) {
        if (item.rule_id || item.file_path || item.message) {
          diagnostics.push({
            source: 'aislop',
            rule_id: item.rule_id || item.rule || 'AI_SLOP_DETECTED',
            severity: (item.severity || 'ERROR').toUpperCase() as any,
            file_path: item.file_path || item.file || 'unknown',
            range: item.range || (item.line ? {
              start: { line: item.line, column: item.column || 1 },
              end: { line: item.end_line || item.line, column: item.end_column || 80 },
            } : undefined),
            code_snippet: item.code_snippet || item.snippet,
            error_message: item.error_message || item.message || 'AI Slop pattern detected',
            repair_instruction: item.repair_instruction || generateAislopRepair(item.rule_id || item.rule, item.code_snippet),
          });
        }
      }
      if (diagnostics.length > 0) return diagnostics;
    } catch {
      // Continue to regex parser if JSON parse fails
    }
  }

  // 2. Regex parser for CLI textual output
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Pattern 1: filePath:line:col: [RULE_ID] message
    const match1 = line.match(/^([^\s:]+):(\d+):(\d+):\s*(?:\[([^\]]+)\])?\s*(.*)$/);
    if (match1) {
      const [, filePath, lineStr, colStr, ruleId, msg] = match1;
      const effectiveRuleId = ruleId || detectRuleFromMessage(msg);
      diagnostics.push({
        source: 'aislop',
        rule_id: effectiveRuleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + 20 },
        },
        error_message: msg || 'AI Slop pattern detected',
        repair_instruction: generateAislopRepair(effectiveRuleId),
      });
      continue;
    }

    // Pattern 2: [aislop] (RULE_ID) file:line - message
    const match2 = line.match(/\[aislop\]\s*(?:\(([^)]+)\))?\s*([^\s:]+)(?::(\d+))?(?::(\d+))?[:\s-]+(.*)/i);
    if (match2) {
      const [, ruleId, filePath, lineStr, colStr, msg] = match2;
      const lineNum = lineStr ? parseInt(lineStr, 10) : 1;
      const colNum = colStr ? parseInt(colStr, 10) : 1;
      const effectiveRuleId = ruleId || detectRuleFromMessage(msg);
      diagnostics.push({
        source: 'aislop',
        rule_id: effectiveRuleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 20 },
        },
        error_message: msg.trim() || 'AI Slop pattern detected',
        repair_instruction: generateAislopRepair(effectiveRuleId),
      });
      continue;
    }

    // Pattern 3: AI Slop score threshold exceeded
    if (line.toLowerCase().includes('slop score') || line.toLowerCase().includes('fail-on')) {
      diagnostics.push({
        source: 'aislop',
        rule_id: 'AI_SLOP_THRESHOLD_EXCEEDED',
        severity: 'ERROR',
        file_path: 'codebase',
        error_message: line,
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: 'Refactor AI-generated code patterns to eliminate empty catch blocks, hallucinated imports, and unsafe type casts.',
          repair_tokens: [
            '// Refactor flagged modules with proper error handling and strict types',
          ],
        },
      });
    }
  }

  return diagnostics;
}

/**
 * Infer rule identifier from error message text
 */
function detectRuleFromMessage(msg: string = ''): string {
  const m = msg.toLowerCase();
  if (m.includes('catch') || m.includes('swallow') || m.includes('silent')) {
    return 'AI_SLOP_SWALLOWED_ERROR';
  }
  if (m.includes('cast') || m.includes('any')) {
    return 'AI_SLOP_UNSAFE_CAST';
  }
  if (m.includes('import') || m.includes('module')) {
    return 'AI_SLOP_HALLUCINATED_IMPORT';
  }
  if (m.includes('dead') || m.includes('unused')) {
    return 'AI_SLOP_DEAD_CODE';
  }
  return 'AI_SLOP_PATTERN_DETECTED';
}

/**
 * Generate actionable repair tokens based on the identified AISlop rule
 */
function generateAislopRepair(ruleId: string = '', snippet?: string): DiagnosticItem['repair_instruction'] {
  const r = ruleId.toUpperCase();
  if (r.includes('SWALLOW') || r.includes('CATCH') || r.includes('EMPTY')) {
    return {
      action: 'REWRITE_BLOCK',
      description: 'Handle the exception explicitly. Either log the error, rethrow a custom Error, or return an explicit failure response.',
      repair_tokens: [
        "import { AppError } from '../errors';",
        "throw new AppError('Operation failed', { cause: error });",
      ],
    };
  }

  if (r.includes('CAST') || r.includes('ANY')) {
    return {
      action: 'REPLACE_TOKEN',
      description: 'Replace unsafe `any` cast with a validated schema parser (such as Zod) or a specific TypeScript interface/type guard.',
      repair_tokens: [
        'if (!isValidPayload(data)) throw new Error("Invalid payload");',
      ],
    };
  }

  if (r.includes('IMPORT') || r.includes('HALLUCINAT')) {
    return {
      action: 'INSERT_IMPORT',
      description: 'Import from a valid installed dependency or implement the required utility locally.',
      repair_tokens: [
        "// Verify dependency is listed in package.json/pyproject.toml or import from local utils",
      ],
    };
  }

  return {
    action: 'REWRITE_BLOCK',
    description: 'Refactor the flagged block to conform with deterministic mechanical gate rules.',
    repair_tokens: snippet ? [snippet] : ['// Refactor to handle errors and types deterministically'],
  };
}
