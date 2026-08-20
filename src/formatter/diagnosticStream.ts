import type {
  DiagnosticEnvelope,
  DiagnosticItem,
  DiagnosticSeverity,
  GateStage,
} from '../types/index.js';
import { stripAnsi } from './ansi.js';
import { parseAislopOutput } from './parsers/aislop.js';
import { parseBiomeOutput } from './parsers/biome.js';
import { parseRuffOutput } from './parsers/ruff.js';
import { parseSkillcheckOutput } from './parsers/skillcheck.js';
import { parseTrufflehogOutput } from './parsers/trufflehog.js';
import { parseTyposOutput } from './parsers/typos.js';
import { parseActionlintOutput } from './parsers/actionlint.js';
import { parseGenericOutput } from './parsers/generic.js';

export interface FormatOptions {
  stage?: GateStage;
  toolName?: string;
  executionTimeMs?: number;
  toolOutputs?: Record<string, { exitCode: number; stderr: string; stdout: string }>;
}

export class DiagnosticStreamer {
  /**
   * Parse raw output from a tool and return an LSP-compliant DiagnosticEnvelope
   */
  public static format(rawOutput: string, options: FormatOptions = {}): DiagnosticEnvelope {
    const stage = options.stage || 'PreCommit';
    const toolName = (options.toolName || '').toLowerCase().trim();
    const cleanOutput = stripAnsi(rawOutput).trim();

    if (!cleanOutput) {
      return {
        $schema: 'https://json.schemastore.org/lsif.json',
        version: '1.0.0',
        status: 'GATE_PASSED',
        summary: {
          total_errors: 0,
          total_warnings: 0,
          gate_stage: stage,
        },
        diagnostics: [],
        metadata: {
          execution_time_ms: options.executionTimeMs,
          tool_outputs: options.toolOutputs,
        },
      };
    }

    let diagnostics: DiagnosticItem[] = [];

    // Route to appropriate parser with strict naming order
    if (toolName === 'trufflehog' || toolName.includes('trufflehog') || cleanOutput.includes('trufflehog') || cleanOutput.includes('DetectorName')) {
      diagnostics = parseTrufflehogOutput(cleanOutput);
    } else if (toolName === 'aislop' || toolName.includes('aislop') || cleanOutput.includes('aislop') || cleanOutput.includes('AI_SLOP')) {
      diagnostics = parseAislopOutput(cleanOutput);
    } else if (toolName === 'biome' || toolName.includes('biome') || cleanOutput.includes('biome') || cleanOutput.includes('noExplicitAny')) {
      diagnostics = parseBiomeOutput(cleanOutput);
    } else if (toolName === 'ruff' || (toolName !== 'trufflehog' && toolName.includes('ruff')) || cleanOutput.includes('ruff') || /F\d{3}|E\d{3}|B\d{3}/.test(cleanOutput)) {
      diagnostics = parseRuffOutput(cleanOutput);
    } else if (toolName === 'skillcheck' || toolName.includes('skillcheck') || cleanOutput.includes('skillcheck') || cleanOutput.includes('SKILL.md')) {
      diagnostics = parseSkillcheckOutput(cleanOutput);
    } else if (toolName === 'typos' || toolName.includes('typos') || /should be/.test(cleanOutput)) {
      diagnostics = parseTyposOutput(cleanOutput);
    } else if (toolName === 'actionlint' || toolName.includes('actionlint')) {
      diagnostics = parseActionlintOutput(cleanOutput);
    } else {
      diagnostics = parseGenericOutput(cleanOutput, options.toolName || 'gate');
    }

    // If specialized parser returned no items, try fallback
    if (diagnostics.length === 0 && cleanOutput.length > 0) {
      diagnostics = parseGenericOutput(cleanOutput, options.toolName || 'gate');
    }

    const totalErrors = diagnostics.filter(d => d.severity === 'ERROR').length;
    const totalWarnings = diagnostics.filter(d => d.severity === 'WARNING').length;

    return {
      $schema: 'https://json.schemastore.org/lsif.json',
      version: '1.0.0',
      status: totalErrors > 0 ? 'GATE_FAILED' : 'GATE_PASSED',
      summary: {
        total_errors: totalErrors,
        total_warnings: totalWarnings,
        gate_stage: stage,
      },
      diagnostics,
      metadata: {
        execution_time_ms: options.executionTimeMs,
        tool_outputs: options.toolOutputs,
      },
    };
  }

  /**
   * Aggregate multiple tool results into a single DiagnosticEnvelope
   */
  public static aggregate(
    toolResults: Array<{ toolName: string; output: string; exitCode: number }>,
    options: FormatOptions = {}
  ): DiagnosticEnvelope {
    const stage = options.stage || 'PreCommit';
    const allDiagnostics: DiagnosticItem[] = [];
    const toolOutputs: Record<string, { exitCode: number; stderr: string; stdout: string }> = {};

    for (const res of toolResults) {
      toolOutputs[res.toolName] = {
        exitCode: res.exitCode,
        stderr: res.exitCode !== 0 ? res.output : '',
        stdout: res.exitCode === 0 ? res.output : '',
      };

      if (res.exitCode !== 0) {
        const envelope = DiagnosticStreamer.format(res.output, {
          stage,
          toolName: res.toolName,
        });
        allDiagnostics.push(...envelope.diagnostics);
      }
    }

    const totalErrors = allDiagnostics.filter(d => d.severity === 'ERROR').length;
    const totalWarnings = allDiagnostics.filter(d => d.severity === 'WARNING').length;

    return {
      $schema: 'https://json.schemastore.org/lsif.json',
      version: '1.0.0',
      status: totalErrors > 0 ? 'GATE_FAILED' : 'GATE_PASSED',
      summary: {
        total_errors: totalErrors,
        total_warnings: totalWarnings,
        gate_stage: stage,
      },
      diagnostics: allDiagnostics,
      metadata: {
        execution_time_ms: options.executionTimeMs,
        tool_outputs: toolOutputs,
      },
    };
  }

  /**
   * Output JSON diagnostic envelope to stdout/stderr
   */
  public static streamJson(envelope: DiagnosticEnvelope, outStream: NodeJS.WritableStream = process.stderr): void {
    outStream.write(JSON.stringify(envelope, null, 2) + '\n');
  }
}

export function formatDiagnostics(rawOutput: string, options?: FormatOptions): DiagnosticEnvelope {
  return DiagnosticStreamer.format(rawOutput, options);
}
