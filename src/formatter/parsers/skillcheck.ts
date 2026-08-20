import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseSkillcheckOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // Check JSON
  if (clean.trim().startsWith('{') || clean.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(clean);
      const items = Array.isArray(parsed) ? parsed : (parsed.violations || parsed.diagnostics || [parsed]);
      for (const item of items) {
        diagnostics.push({
          source: 'skillcheck',
          rule_id: item.rule_id || item.rule || 'SKILL_CHECK_VIOLATION',
          severity: (item.severity || 'ERROR').toUpperCase() as any,
          file_path: item.file_path || item.file || 'SKILL.md',
          range: item.range || {
            start: { line: item.line || 1, column: item.column || 1 },
            end: { line: item.end_line || item.line || 1, column: item.end_column || 80 },
          },
          code_snippet: item.snippet,
          error_message: item.message || 'Agent skill validation failed',
          repair_instruction: generateSkillcheckRepair(item.rule_id || item.rule),
        });
      }
      if (diagnostics.length > 0) return diagnostics;
    } catch {
      // Continue to regex
    }
  }

  // Regex parser
  const lines = clean.split('\n');
  for (const line of lines) {
    const match = line.match(/^([^\s:]+\.md)(?::(\d+))?(?::(\d+))?:\s*(?:\[([^\]]+)\])?\s*(.*)$/i);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId, msg] = match;
      const lineNum = lineStr ? parseInt(lineStr, 10) : 1;
      const colNum = colStr ? parseInt(colStr, 10) : 1;
      const effectiveRuleId = ruleId || detectSkillRule(msg);

      diagnostics.push({
        source: 'skillcheck',
        rule_id: effectiveRuleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 30 },
        },
        error_message: msg.trim() || 'Agent skill configuration violation',
        repair_instruction: generateSkillcheckRepair(effectiveRuleId),
      });
    }
  }

  return diagnostics;
}

function detectSkillRule(msg: string = ''): string {
  const m = msg.toLowerCase();
  if (m.includes('frontmatter') || m.includes('yaml') || m.includes('header')) {
    return 'SKILL_INVALID_FRONTMATTER';
  }
  if (m.includes('permission') || m.includes('grant') || m.includes('over-grant')) {
    return 'SKILL_OVER_GRANTED_PERMISSIONS';
  }
  if (m.includes('prompt injection') || m.includes('escape') || m.includes('security')) {
    return 'SKILL_SECURITY_RISK';
  }
  if (m.includes('trigger') || m.includes('description')) {
    return 'SKILL_MISSING_METADATA';
  }
  return 'SKILL_VALIDATION_ERROR';
}

function generateSkillcheckRepair(ruleId: string = ''): DiagnosticItem['repair_instruction'] {
  const r = ruleId.toUpperCase();
  if (r.includes('FRONTMATTER') || r.includes('METADATA')) {
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

  if (r.includes('PERMISSION') || r.includes('SECURITY')) {
    return {
      action: 'REWRITE_BLOCK',
      description: 'Restrict permissions to the minimal set of required tools and paths.',
      repair_tokens: [
        '# Enforce least-privilege tool access boundaries',
      ],
    };
  }

  return {
    action: 'MANUAL_FIX',
    description: 'Format agent skill markdown according to the Agent Skill standard.',
    repair_tokens: ['# Skill Documentation and Instructions'],
  };
}
