/**
 * @file src/runner/gateRunner.ts
 * @description Execution engine for mechanical gate stages (post-edit, pre-commit, pre-push).
 *
 * Runs stage-specific linters, formatters, and scanners, parses failure streams,
 * and emits structured LSP Diagnostic Envelopes with exit codes.
 */

import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { DiagnosticEnvelope, GateStage } from '../types/index.js';
import { DiagnosticStreamer, type ToolExecutionResult } from '../formatter/diagnosticStream.js';

/**
 * Options for configuring GateRunner execution
 */
export interface GateRunnerOptions {
  /** Target working directory (defaults to process.cwd()) */
  cwd?: string;
  /** Custom environment variables */
  env?: NodeJS.ProcessEnv;
}

/**
 * Stage Execution Engine for Mechanical Hard Gates.
 */
export class GateRunner {
  /** Resolved absolute path of the target repository */
  private readonly rootPath: string;
  /** Environment variables passed to child processes */
  private readonly env: NodeJS.ProcessEnv;

  /**
   * Initialize a new GateRunner instance
   * @param options Runner configuration options
   */
  constructor(options: GateRunnerOptions = {}) {
    this.rootPath = path.resolve(options.cwd || process.cwd());
    this.env = { ...process.env, ...options.env };
  }

  /**
   * Execute Stage 1: PostFileEdit tool interceptor on a single modified file.
   * Runs in < 300ms on ASTs using Biome, Ruff, or SkillCheck.
   *
   * @param filePath Relative or absolute path of the modified file
   * @returns DiagnosticEnvelope detailing formatting/linting findings
   */
  public runPostEdit(filePath: string): DiagnosticEnvelope {
    const startTime = Date.now();
    const fullPath = path.resolve(this.rootPath, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const toolResults: ToolExecutionResult[] = [];

    // JS/TS: Run Biome check with auto-write
    if (['.js', '.ts', '.jsx', '.tsx', '.json', '.jsonc'].includes(ext)) {
      const res = this.execCommand('npx', ['@biomejs/biome', 'check', '--write', fullPath]);
      toolResults.push({ toolName: 'biome', output: res.output, exitCode: res.exitCode });
    }

    // Python: Run Ruff check with auto-fix
    if (['.py'].includes(ext)) {
      const res = this.execCommand('ruff', ['check', '--fix', fullPath]);
      toolResults.push({ toolName: 'ruff', output: res.output, exitCode: res.exitCode });
    }

    // Skill markdown: Run skillcheck validator
    if (fullPath.includes('.claude/skills') || fullPath.endsWith('SKILL.md')) {
      const res = this.execCommand('skillcheck', ['check', fullPath]);
      toolResults.push({ toolName: 'skillcheck', output: res.output, exitCode: res.exitCode });
    }

    const duration = Date.now() - startTime;
    return DiagnosticStreamer.aggregate(toolResults, {
      stage: 'PostFileEdit',
      executionTimeMs: duration,
    });
  }

  /**
   * Execute Stage 2: Synchronous Local Pre-Commit Hard Gate (< 2.0s target).
   * Invokes Lefthook to run parallel staged checks (Biome, Ruff, AISlop, TruffleHog, Typos, Actionlint).
   *
   * @returns DiagnosticEnvelope aggregating all staged failure diagnostics
   */
  public runPreCommit(): DiagnosticEnvelope {
    const startTime = Date.now();
    const res = this.execCommand('npx', ['lefthook', 'run', 'pre-commit']);
    const duration = Date.now() - startTime;

    return DiagnosticStreamer.aggregate(
      [{ toolName: 'lefthook-pre-commit', output: res.output, exitCode: res.exitCode }],
      { stage: 'PreCommit', executionTimeMs: duration }
    );
  }

  /**
   * Execute Stage 3: Pre-Push / CI Full Codebase Graph Governance.
   * Invokes Lefthook to run pre-push checks (Fallow, Sherif, OWASP Noir).
   *
   * @returns DiagnosticEnvelope aggregating graph audit results
   */
  public runPrePush(): DiagnosticEnvelope {
    const startTime = Date.now();
    const res = this.execCommand('npx', ['lefthook', 'run', 'pre-push']);
    const duration = Date.now() - startTime;

    return DiagnosticStreamer.aggregate(
      [{ toolName: 'lefthook-pre-push', output: res.output, exitCode: res.exitCode }],
      { stage: 'PrePush', executionTimeMs: duration }
    );
  }

  /**
   * Helper to spawn a shell command synchronously and capture output
   */
  private execCommand(command: string, args: string[]): { exitCode: number; output: string } {
    try {
      const proc = spawnSync(command, args, {
        cwd: this.rootPath,
        env: this.env,
        encoding: 'utf-8',
        shell: process.platform === 'win32',
      });

      const stdout = proc.stdout || '';
      const stderr = proc.stderr || '';
      const output = `${stdout}\n${stderr}`.trim();
      const exitCode = proc.status ?? (proc.error ? 1 : 0);

      return { exitCode, output };
    } catch (err: any) {
      return { exitCode: 1, output: err.message || 'Execution failed' };
    }
  }
}
