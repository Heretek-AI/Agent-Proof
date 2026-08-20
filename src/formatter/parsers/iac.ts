/**
 * @file src/formatter/parsers/iac.ts
 * @description Parses Terraform (tfsec) and Kubernetes (kube-score) static analysis findings into LSP DiagnosticItems.
 */

import type { DiagnosticItem, DiagnosticSeverity } from '../../types/index.js';

/**
 * Parse tfsec output into standardized LSP diagnostic items with repair tokens.
 *
 * @param output Raw terminal stdout/stderr from tfsec
 * @returns Array of DiagnosticItem objects
 */
export function parseTfsecOutput(output: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Line format: path/to/main.tf:12 [HIGH] Description (aws-s3-enable-bucket-encryption)
    const match = trimmed.match(/^([^:]+):(\d+)\s+\[([A-Z]+)\]\s+(.*?)\s*\(([a-zA-Z0-9_-]+)\)$/);
    if (match) {
      const [, filePath, lineStr, severityStr, msg, ruleId] = match;
      const lineNum = parseInt(lineStr, 10) || 1;
      const severity: DiagnosticSeverity = ['HIGH', 'CRITICAL', 'ERROR'].includes(severityStr.toUpperCase()) ? 'ERROR' : 'WARNING';

      diagnostics.push({
        source: 'tfsec',
        rule_id: ruleId,
        severity,
        file_path: filePath,
        range: {
          start: { line: lineNum, column: 1 },
          end: { line: lineNum, column: 80 },
        },
        error_message: `${msg} (${ruleId})`,
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: `Fix Terraform security misconfiguration: ${ruleId}`,
          repair_tokens: [`# Apply secure configuration for ${ruleId}`],
        },
      });
    }
  }

  return diagnostics;
}

/**
 * Parse kube-score output into standardized LSP diagnostic items.
 *
 * @param output Raw terminal stdout/stderr from kube-score
 * @returns Array of DiagnosticItem objects
 */
export function parseKubeScoreOutput(output: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Line format: [CRITICAL] Container Security Context: (container-security-context)
    const match = trimmed.match(/^\[([A-Z]+)\]\s+(.*?)(?:\s*\((.*?)\))?$/);
    if (match) {
      const [, severityStr, msg, ruleId] = match;
      const severity: DiagnosticSeverity = ['CRITICAL', 'ERROR'].includes(severityStr.toUpperCase()) ? 'ERROR' : 'WARNING';
      const id = ruleId || 'KUBE_SCORE_SECURITY';

      diagnostics.push({
        source: 'kube-score',
        rule_id: id,
        severity,
        file_path: 'k8s/manifest.yaml',
        error_message: msg,
        repair_instruction: {
          action: 'REWRITE_BLOCK',
          description: `Resolve Kubernetes security finding: ${msg}`,
          repair_tokens: ['securityContext:\n  readOnlyRootFilesystem: true\n  runAsNonRoot: true\n  allowPrivilegeEscalation: false'],
        },
      });
    }
  }

  return diagnostics;
}
