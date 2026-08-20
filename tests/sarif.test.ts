import { describe, it, expect } from 'vitest';
import { SarifStreamer, formatSarif } from '../src/formatter/sarifStream';
import type { DiagnosticItem } from '../src/types';

describe('SarifStreamer — SARIF v2.1.0 Output Generator with Exact Repair Regions', () => {
  it('converts DiagnosticItem array into valid SARIF v2.1.0 log structure', () => {
    const diagnostics: DiagnosticItem[] = [
      {
        source: 'aislop',
        rule_id: 'AI_SLOP_SWALLOWED_ERROR',
        severity: 'ERROR',
        file_path: 'src/services/telemetry.ts',
        range: {
          start: { line: 42, column: 11 },
          end: { line: 42, column: 18 },
        },
        error_message: "Variable 'payload' dynamically typed to unsafe 'any'.",
        repair_instruction: {
          action: 'REPLACE_TOKEN',
          description: 'Apply explicit interface constraint.',
          repair_tokens: ['payload: TelemetryEnvelope'],
        },
      },
    ];

    const sarif = SarifStreamer.toSarifLog(diagnostics);

    expect(sarif.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);

    const run = sarif.runs[0];
    expect(run.results).toHaveLength(1);

    const res = run.results[0];
    expect(res.ruleId).toBe('AI_SLOP_SWALLOWED_ERROR');
    expect(res.level).toBe('error');
    expect(res.locations[0].physicalLocation.artifactLocation.uri).toBe('src/services/telemetry.ts');
    expect(res.locations[0].physicalLocation.region?.startLine).toBe(42);

    expect(res.fixes).toHaveLength(1);
    const fix = res.fixes![0];
    expect(fix.description.text).toBe('Apply explicit interface constraint.');
    expect(fix.artifactChanges[0].replacements[0].deletedRegion.startLine).toBe(42);
    expect(fix.artifactChanges[0].replacements[0].insertedContent?.text).toBe('payload: TelemetryEnvelope');
  });

  it('formats to valid JSON string with formatSarif convenience function', () => {
    const diagnostics: DiagnosticItem[] = [
      {
        source: 'ruff',
        rule_id: 'F401',
        severity: 'ERROR',
        file_path: 'app/server.py',
        error_message: "'os' imported but unused",
      },
    ];

    const jsonStr = formatSarif(diagnostics);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.version).toBe('2.1.0');
    expect(parsed.runs[0].results[0].ruleId).toBe('F401');
  });
});
