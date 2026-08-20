/**
 * @file src/formatter/sarifStream.ts
 * @description SARIF v2.1.0 Output Generator with Exact Replacement Fix Regions.
 *
 * Implements standard OASIS Static Analysis Results Interchange Format (SARIF)
 * schema (https://json.schemastore.org/sarif-2.1.0.json) enriched with machine-actionable
 * fixes, regions, and replacement tokens for deterministic AI self-correction loops.
 */

import type { DiagnosticItem, SarifLog, SarifResult, SarifFix } from '../types/index.js';

/**
 * SARIF v2.1.0 Diagnostic Formatter.
 */
export class SarifStreamer {
  /**
   * Convert standardized DiagnosticItem array into a fully-compliant SARIF v2.1.0 Log.
   *
   * @param diagnostics Array of DiagnosticItem findings
   * @param driverName Name of the primary gate driver
   * @returns SarifLog object conforming to SARIF v2.1.0
   */
  public static toSarifLog(diagnostics: DiagnosticItem[], driverName: string = 'AgentProofDeterministicGate'): SarifLog {
    const rulesMap = new Map<string, { id: string; shortDescription: { text: string } }>();
    const results: SarifResult[] = [];

    for (const diag of diagnostics) {
      if (!rulesMap.has(diag.rule_id)) {
        rulesMap.set(diag.rule_id, {
          id: diag.rule_id,
          shortDescription: {
            text: diag.repair_instruction?.description || `Rule ${diag.rule_id} finding`,
          },
        });
      }

      const level = diag.severity === 'ERROR'
        ? 'error'
        : diag.severity === 'WARNING'
        ? 'warning'
        : 'note';

      const startLine = diag.range?.start?.line || 1;
      const startColumn = diag.range?.start?.column || 1;
      const endLine = diag.range?.end?.line || startLine;
      const endColumn = diag.range?.end?.column || (startColumn + 20);

      const fixes: SarifFix[] = [];

      if (diag.repair_instruction) {
        const replacementText = diag.repair_instruction.repair_tokens.length > 0
          ? diag.repair_instruction.repair_tokens.join('\n')
          : undefined;

        fixes.push({
          description: {
            text: diag.repair_instruction.description,
          },
          artifactChanges: [
            {
              artifactLocation: {
                uri: diag.file_path,
              },
              replacements: [
                {
                  deletedRegion: {
                    startLine,
                    startColumn,
                    endLine,
                    endColumn,
                  },
                  insertedContent: replacementText
                    ? { text: replacementText }
                    : undefined,
                },
              ],
            },
          ],
        });
      }

      results.push({
        ruleId: diag.rule_id,
        level,
        message: {
          text: diag.error_message,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: diag.file_path,
              },
              region: {
                startLine,
                startColumn,
                endLine,
                endColumn,
              },
            },
          },
        ],
        fixes: fixes.length > 0 ? fixes : undefined,
      });
    }

    return {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: driverName,
              version: '1.0.0',
              informationUri: 'https://github.com/Heretek-AI/Agent-Proof',
              rules: Array.from(rulesMap.values()),
            },
          },
          results,
        },
      ],
    };
  }

  /**
   * Convert diagnostics to a formatted SARIF JSON string
   *
   * @param diagnostics Array of DiagnosticItem findings
   * @param driverName Tool driver name
   * @returns Formatted JSON string
   */
  public static formatSarifJson(diagnostics: DiagnosticItem[], driverName?: string): string {
    const sarif = SarifStreamer.toSarifLog(diagnostics, driverName);
    return JSON.stringify(sarif, null, 2);
  }
}

/**
 * Functional convenience wrapper to format diagnostics to SARIF JSON
 */
export function formatSarif(diagnostics: DiagnosticItem[], driverName?: string): string {
  return SarifStreamer.formatSarifJson(diagnostics, driverName);
}
