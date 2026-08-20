/**
 * @file src/formatter/parsers/skillcheck.ts
 * @description SkillCheck output parser for agent skill files and markdown instructions.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw stdout/stderr from `skillcheck` into structured DiagnosticItems.
 *
 * @param rawOutput Raw terminal output from SkillCheck
 * @returns Array of DiagnosticItem objects with YAML frontmatter repair tokens
 */
export function parseSkillcheckOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];
  const lines = clean.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Pattern 1: filePath:line:col: [RULE_ID] message
    const match = trimmed.match(/^([^\s:]+):(\d+):(\d+):\s*(?:\[([^\]]+)\])?\s*(.*)$/);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId, message] = match;
      const effectiveRuleId = ruleId || 'SKILL_VALIDATION_ERROR';
      diagnostics.push({
        source: 'skillcheck',
        rule_id: effectiveRuleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) },
          end: { line: parseInt(lineStr, 10), column: parseInt(colStr, 10) + 30 },
        },
        error_message: message.trim(),
        repair_instruction: generateSkillRepair(effectiveRuleId, message.trim()),
      });
      continue;
    }

    // Pattern 2: [skillcheck] error in filePath: message
    const match2 = trimmed.match(/\[skillcheck\]\s*(?:error|warning)?\s*(?:in\s+)?([^\s:]+)(?::(\d+))?:\s*(.*)/i);
    if (match2) {
      const [, filePath, lineStr, message] = match2;
      const lineNum = lineStr ? parseInt(lineStr, 10) : 1;
      diagnostics.push({
        source: 'skillcheck',
        rule_id: 'SKILL_VALIDATION_ERROR',
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: 1 },
          end: { line: lineNum, column: 40 },
        },
        error_message: message.trim(),
        repair_instruction: generateSkillRepair('SKILL_VALIDATION_ERROR', message.trim()),
      });
    }
  }

  return diagnostics;
}

/**
 * Generate actionable YAML frontmatter repair tokens for skill files
 */
function generateSkillRepair(ruleId: string, message: string): DiagnosticItem['repair_instruction'] {
  const m = message.toLowerCase();
  if (m.includes('frontmatter') || m.includes('header') || ruleId.includes('FRONTMATTER')) {
    return {
      action: 'REWRITE_BLOCK',
      description: 'Ensure skill file starts with valid YAML frontmatter containing name and description.',
      repair_tokens: [
        '---',
        'name: "my-skill"',
        'description: "Clear actionable description of when this skill should be invoked"',
        '---',
      ],
    };
  }

  return {
    action: 'REWRITE_BLOCK',
    description: 'Ensure skill adheres to schema specifications and OWASP agentic boundaries.',
    repair_tokens: ['# Verify skill name, description, and input schema definitions'],
  };
}
