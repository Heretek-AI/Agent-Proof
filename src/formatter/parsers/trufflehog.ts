/**
 * @file src/formatter/parsers/trufflehog.ts
 * @description TruffleHog output parser for high-entropy secret detection.
 */

import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

/**
 * Parse raw stdout/stderr from `trufflehog` into structured DiagnosticItems.
 * Supports NDJSON (newline-delimited JSON) emitted by `trufflehog --json`.
 *
 * @param rawOutput Raw output from TruffleHog
 * @returns Array of DiagnosticItem objects with credential revocation instructions
 */
export function parseTrufflehogOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];
  const lines = clean.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for TruffleHog NDJSON line
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const item = JSON.parse(trimmed);
        const detector = item.DetectorName || item.DetectorType || 'SECRET';
        const filePath = item.SourceMetadata?.Data?.Git?.file || item.SourceMetadata?.Data?.Filesystem?.file || 'unknown';
        const lineNum = item.SourceMetadata?.Data?.Git?.line || 1;
        const verified = item.Verified === true;

        diagnostics.push({
          source: 'trufflehog',
          rule_id: `VERIFIED_SECRET_${detector.toUpperCase()}`,
          severity: 'ERROR',
          file_path: filePath,
          range: {
            start: { line: lineNum, column: 1 },
            end: { line: lineNum, column: 80 },
          },
          error_message: `Verified high-entropy credential or secret detected (${detector}).${verified ? ' [VERIFIED ACTIVE]' : ''}`,
          repair_instruction: {
            action: 'REPLACE_TOKEN',
            description: `Revoke this exposed ${detector} credential immediately and replace hardcoded secret with an environment variable lookup.`,
            repair_tokens: [
              `process.env.${detector.toUpperCase()}_KEY || process.env.API_KEY`,
            ],
          },
        });
        continue;
      } catch {
        // Continue to regex if JSON parse fails
      }
    }

    // Pattern 2: Textual secret detection finding
    const match = trimmed.match(/found\s+([a-zA-Z0-9_\-]+)\s+secret\s+in\s+([^\s:]+)(?::(\d+))?/i);
    if (match) {
      const [, detector, filePath, lineStr] = match;
      const lineNum = lineStr ? parseInt(lineStr, 10) : 1;
      diagnostics.push({
        source: 'trufflehog',
        rule_id: `SECRET_${detector.toUpperCase()}`,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: 1 },
          end: { line: lineNum, column: 80 },
        },
        error_message: `Secret detected: ${detector}`,
        repair_instruction: {
          action: 'REPLACE_TOKEN',
          description: `Replace hardcoded ${detector} secret with an environment variable.`,
          repair_tokens: [`process.env.${detector.toUpperCase()}`],
        },
      });
    }
  }

  return diagnostics;
}
