/**
 * @file src/formatter/parsers/hadolint.ts
 * @description Parses hadolint Dockerfile static analysis findings into LSP DiagnosticItems.
 */

import type { DiagnosticItem, DiagnosticSeverity } from '../../types/index.js';

/**
 * Parse hadolint output (line-based) into standardized LSP diagnostic items with repair tokens.
 *
 * @param output Raw terminal stdout/stderr from hadolint
 * @returns Array of DiagnosticItem objects
 */
export function parseHadolintOutput(output: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Line format: Dockerfile:line DL3008 warning: Pin versions in apt get install
    const match = trimmed.match(/^([^:]+):(\d+)\s+([A-Z0-9]+)\s+([a-zA-Z]+):\s*(.*)$/);
    if (match) {
      const [, filePath, lineStr, ruleId, severityStr, msg] = match;
      const lineNum = parseInt(lineStr, 10) || 1;
      const severity: DiagnosticSeverity = severityStr.toLowerCase() === 'error' ? 'ERROR' : 'WARNING';

      let repairTokens: string[] = [];
      let repairDesc = `Resolve Dockerfile rule: ${ruleId}`;

      if (ruleId === 'DL3002') {
        repairDesc = 'Switch to non-root user before executing commands in production container';
        repairTokens = ['USER node', 'USER 1000:1000'];
      } else if (ruleId === 'DL3008') {
        repairDesc = 'Pin package versions when using apt-get install';
        repairTokens = ['RUN apt-get update && apt-get install -y --no-install-recommends package=1.2.3 && rm -rf /var/lib/apt/lists/*'];
      } else if (ruleId === 'DL3018') {
        repairDesc = 'Pin package versions when using apk add';
        repairTokens = ['RUN apk add --no-cache package=1.2.3'];
      } else if (ruleId === 'DL3059') {
        repairDesc = 'Consolidate multiple RUN instructions to reduce container image layers';
        repairTokens = ['RUN command1 && \\\n    command2'];
      }

      diagnostics.push({
        source: 'hadolint',
        rule_id: ruleId,
        severity,
        file_path: filePath,
        range: {
          start: { line: lineNum, column: 1 },
          end: { line: lineNum, column: 80 },
        },
        error_message: msg || `Hadolint warning: ${ruleId}`,
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: repairDesc,
          repair_tokens: repairTokens.length > 0 ? repairTokens : [`# Resolve Dockerfile issue: ${ruleId}`],
        },
      });
    }
  }

  return diagnostics;
}
