/**
 * @file src/formatter/parsers/zizmor.ts
 * @description Parses zizmor GitHub Actions workflow security audit findings into LSP DiagnosticItems.
 */

import type { DiagnosticItem, DiagnosticSeverity } from '../../types/index.js';

/**
 * Parse zizmor output (line-based or JSON) into standardized LSP diagnostic items with repair tokens.
 *
 * @param output Raw terminal stdout/stderr from zizmor
 * @returns Array of DiagnosticItem objects
 */
export function parseZizmorOutput(output: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Line format: path/to/workflow.yml:line:col: [rule-name] message
    const match = trimmed.match(/^([^:]+):(\d+):(\d+):\s*\[?([a-zA-Z0-9_-]+)\]?\s*(.*)$/);
    if (match) {
      const [, filePath, lineStr, colStr, ruleId, msg] = match;
      const lineNum = parseInt(lineStr, 10) || 1;
      const colNum = parseInt(colStr, 10) || 1;

      let repairTokens: string[] = [];
      let repairDesc = `Fix GitHub Actions security issue: ${ruleId}`;

      if (ruleId.includes('unpinned-uses') || msg.includes('unpinned')) {
        repairDesc = 'Pin GitHub Action by full 40-character commit SHA rather than tag';
        repairTokens = ['uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1'];
      } else if (ruleId.includes('template-injection') || msg.includes('injection')) {
        repairDesc = 'Sanitize context expressions by assigning to env variables rather than inline script templates';
        repairTokens = ['env:\n  USER_INPUT: ${{ github.event.issue.title }}'];
      } else if (ruleId.includes('excessive-permissions') || msg.includes('permissions')) {
        repairDesc = 'Set least-privilege workflow permissions';
        repairTokens = ['permissions:\n  contents: read'];
      }

      diagnostics.push({
        source: 'zizmor',
        rule_id: ruleId,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: colNum },
          end: { line: lineNum, column: colNum + 20 },
        },
        error_message: msg || `Zizmor security warning: ${ruleId}`,
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: repairDesc,
          repair_tokens: repairTokens.length > 0 ? repairTokens : [`# Security fix for ${ruleId}`],
        },
      });
    }
  }

  // If no line matches found but output indicates failure, emit summary
  if (diagnostics.length === 0 && output.toLowerCase().includes('error')) {
    diagnostics.push({
      source: 'zizmor',
      rule_id: 'ZIZMOR_SECURITY_ALERT',
      severity: 'ERROR',
      file_path: '.github/workflows',
      error_message: output.slice(0, 300),
      repair_instruction: {
        action: 'MANUAL_FIX',
        description: 'Resolve GitHub Actions workflow security warnings reported by zizmor.',
        repair_tokens: ['# Audit and harden GitHub Actions workflow permissions and action SHAs'],
      },
    });
  }

  return diagnostics;
}
