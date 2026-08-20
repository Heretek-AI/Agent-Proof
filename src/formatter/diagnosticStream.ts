/**
 * @file src/formatter/diagnosticStream.ts
 * @description LSP-compliant Diagnostic Streaming Engine.
 *
 * Intercepts, deduplicates, and aggregates outputs from all governance tools
 * (AISlop, Biome, Ruff, SkillCheck, TruffleHog, Typos, Actionlint) and formats
 * them into a standardized JSON Diagnostic Envelope ($schema: https://json.schemastore.org/lsif.json).
 *
 * Embeds actionable `repair_tokens` enabling autonomous LLM self-correction.
 */

import type { DiagnosticEnvelope, DiagnosticItem, GateStage } from '../types/index.js';
import { parseAislopOutput } from './parsers/aislop.js';
import { parseBiomeOutput } from './parsers/biome.js';
import { parseRuffOutput } from './parsers/ruff.js';
import { parseSkillcheckOutput } from './parsers/skillcheck.js';
import { parseTrufflehogOutput } from './parsers/trufflehog.js';
import { parseTyposOutput } from './parsers/typos.js';
import { parseActionlintOutput } from './parsers/actionlint.js';
import { parseGenericOutput } from './parsers/generic.js';

/**
 * Options for configuring DiagnosticStreamer formatting
 */
export interface DiagnosticStreamerOptions {
  /** Target gate stage (PostFileEdit, PreCommit, PrePush, CI) */
  stage?: GateStage;
  /** Execution duration in milliseconds */
  executionTimeMs?: number;
  /** Optional tool name override */
  toolName?: string;
}

/**
 * Raw output payload from an individual tool execution
 */
export interface ToolExecutionResult {
  /** Identifier of the tool (e.g. 'aislop', 'biome', 'ruff', 'trufflehog') */
  toolName: string;
  /** Combined stdout and stderr string */
  output: string;
  /** Process exit status code */
  exitCode: number;
}

/**
 * LSP Diagnostic Streamer and Aggregator.
 * Routes tool outputs to specialized parsers and constructs JSON diagnostic envelopes.
 */
export class DiagnosticStreamer {
  /**
   * Route tool output to the appropriate specialized parser based on tool name heuristics.
   *
   * @param toolName Name of the executed tool
   * @param output Raw terminal output string
   * @returns Array of parsed DiagnosticItem objects
   */
  public static parseToolOutput(toolName: string, output: string): DiagnosticItem[] {
    const lower = toolName.toLowerCase();

    // Check specific tools in deterministic priority order
    if (lower.includes('aislop')) {
      return parseAislopOutput(output);
    }
    if (lower.includes('biome')) {
      return parseBiomeOutput(output);
    }
    if (lower.includes('trufflehog')) {
      return parseTrufflehogOutput(output);
    }
    if (lower.includes('ruff')) {
      return parseRuffOutput(output);
    }
    if (lower.includes('skill') || lower.includes('skillcheck')) {
      return parseSkillcheckOutput(output);
    }
    if (lower.includes('typo')) {
      return parseTyposOutput(output);
    }
    if (lower.includes('actionlint')) {
      return parseActionlintOutput(output);
    }

    return parseGenericOutput(output, toolName);
  }

  /**
   * Aggregate multiple tool execution results into a unified DiagnosticEnvelope.
   *
   * @param results Array of ToolExecutionResult objects
   * @param options Formatting options
   * @returns Complete DiagnosticEnvelope conforming to LSIF JSON schema
   */
  public static aggregate(
    results: ToolExecutionResult[],
    options: DiagnosticStreamerOptions = {}
  ): DiagnosticEnvelope {
    const stage = options.stage || 'PreCommit';
    const allDiagnostics: DiagnosticItem[] = [];
    const toolOutputs: Record<string, { exitCode: number; stderr: string; stdout: string }> = {};

    for (const res of results) {
      toolOutputs[res.toolName] = {
        exitCode: res.exitCode,
        stderr: res.output,
        stdout: '',
      };

      // Only parse diagnostics if tool exited with non-zero exit code
      if (res.exitCode !== 0) {
        const diags = this.parseToolOutput(res.toolName, res.output);
        allDiagnostics.push(...diags);
      }
    }

    const totalErrors = allDiagnostics.filter(d => d.severity === 'ERROR').length;
    const totalWarnings = allDiagnostics.filter(d => d.severity === 'WARNING').length;
    const status = (totalErrors > 0 || results.some(r => r.exitCode !== 0 && allDiagnostics.length === 0))
      ? 'GATE_FAILED'
      : 'GATE_PASSED';

    return {
      $schema: 'https://json.schemastore.org/lsif.json',
      version: '1.0.0',
      status,
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
}

/**
 * Functional convenience wrapper to format a single tool output string into a DiagnosticEnvelope
 *
 * @param rawOutput Raw error string
 * @param options Formatter options
 * @param toolName Optional tool identifier
 */
export function formatDiagnostics(
  rawOutput: string,
  options: DiagnosticStreamerOptions = {},
  toolName?: string
): DiagnosticEnvelope {
  const effectiveToolName = options.toolName || toolName || 'gate';
  return DiagnosticStreamer.aggregate(
    [{ toolName: effectiveToolName, output: rawOutput, exitCode: rawOutput.trim().length > 0 ? 1 : 0 }],
    options
  );
}
