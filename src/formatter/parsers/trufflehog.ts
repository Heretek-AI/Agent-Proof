import type { DiagnosticItem } from '../../types/index.js';
import { stripAnsi } from '../ansi.js';

export function parseTrufflehogOutput(rawOutput: string): DiagnosticItem[] {
  const clean = stripAnsi(rawOutput);
  const diagnostics: DiagnosticItem[] = [];

  // Check JSON / JSON-Lines
  const lines = clean.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const item = JSON.parse(trimmed);
        const detector = item.DetectorName || item.detector_name || 'SECRET';
        const file = item.SourceMetadata?.Data?.Git?.file || item.file || item.file_path || 'unknown';
        const lineNum = item.SourceMetadata?.Data?.Git?.line || item.line || 1;
        const verified = item.Verified ?? true;

        diagnostics.push({
          source: 'trufflehog',
          rule_id: `VERIFIED_SECRET_${detector.toUpperCase()}`,
          severity: 'ERROR',
          file_path: file,
          range: {
            start: { line: lineNum, column: 1 },
            end: { line: lineNum, column: 80 },
          },
          error_message: `${verified ? 'Verified' : 'Unverified'} high-entropy credential or secret detected (${detector}).`,
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
        // Fall through to regex
      }
    }

    // Text regex: Found verified <detector> secret in <file>:<line>
    const match = trimmed.match(/(?:found|detected)\s+(?:verified\s+)?([a-zA-Z0-9_-]+)\s+secret\s+in\s+([^\s:]+)(?::(\d+))?/i);
    if (match) {
      const [, detector, filePath, lineStr] = match;
      const lineNum = lineStr ? parseInt(lineStr, 10) : 1;

      diagnostics.push({
        source: 'trufflehog',
        rule_id: `VERIFIED_SECRET_${detector.toUpperCase()}`,
        severity: 'ERROR',
        file_path: filePath,
        range: {
          start: { line: lineNum, column: 1 },
          end: { line: lineNum, column: 80 },
        },
        error_message: `Verified high-entropy credential or secret detected (${detector}).`,
        repair_instruction: {
          action: 'REPLACE_TOKEN',
          description: `Revoke this exposed ${detector} credential immediately and replace hardcoded secret with an environment variable lookup.`,
          repair_tokens: [
            `process.env.${detector.toUpperCase()}_KEY || process.env.API_KEY`,
          ],
        },
      });
    }
  }

  return diagnostics;
}
