import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import type { DiagnosticEnvelope, GateStage } from '../types/index.js';
import { DiagnosticStreamer } from '../formatter/diagnosticStream.js';
import { detectStack } from '../detector/stackDetector.js';

export interface RunOptions {
  stage: GateStage | 'pre-commit' | 'pre-push' | 'post-edit';
  filePath?: string;
  cwd?: string;
  jsonOutput?: boolean;
}

export interface RunResult {
  passed: boolean;
  exitCode: number;
  envelope: DiagnosticEnvelope;
  rawOutput: string;
}

export class GateRunner {
  private readonly rootPath: string;

  constructor(cwd: string = process.cwd()) {
    this.rootPath = path.resolve(cwd);
  }

  /**
   * Execute gate for a given stage
   */
  public run(options: RunOptions): RunResult {
    const startTime = Date.now();
    const stage = this.normalizeStage(options.stage);

    if (stage === 'PostFileEdit' && options.filePath) {
      return this.runPostFileEdit(options.filePath, startTime);
    }

    if (stage === 'PrePush') {
      return this.runPrePush(startTime);
    }

    return this.runPreCommit(startTime);
  }

  private runPostFileEdit(filePath: string, startTime: number): RunResult {
    const fullPath = path.resolve(this.rootPath, filePath);
    const detection = detectStack(this.rootPath);
    const results: Array<{ toolName: string; output: string; exitCode: number }> = [];

    if (/\.(js|ts|jsx|tsx|json|jsonc)$/.test(filePath) && detection.jsTs.detected) {
      const res = this.execCommand('npx', ['biome', 'check', '--write', fullPath]);
      results.push({ toolName: 'biome', output: res.stdout + res.stderr, exitCode: res.status ?? 0 });
    }

    if (/\.py$/.test(filePath) && detection.python.detected) {
      const res = this.execCommand('ruff', ['check', '--fix', fullPath]);
      results.push({ toolName: 'ruff', output: res.stdout + res.stderr, exitCode: res.status ?? 0 });
    }

    if (filePath.includes('.claude/skills/') || filePath.endsWith('SKILL.md')) {
      const res = this.execCommand('skillcheck', ['check', fullPath]);
      results.push({ toolName: 'skillcheck', output: res.stdout + res.stderr, exitCode: res.status ?? 0 });
    }

    const duration = Date.now() - startTime;
    const envelope = DiagnosticStreamer.aggregate(results, {
      stage: 'PostFileEdit',
      executionTimeMs: duration,
    });

    const passed = envelope.summary.total_errors === 0;
    const combinedOutput = results.map(r => r.output).join('\n');

    return {
      passed,
      exitCode: passed ? 0 : 1,
      envelope,
      rawOutput: combinedOutput,
    };
  }

  private runPreCommit(startTime: number): RunResult {
    // Attempt running lefthook pre-commit
    const lefthookRes = this.execCommand('npx', ['lefthook', 'run', 'pre-commit']);
    const rawOutput = (lefthookRes.stdout || '') + (lefthookRes.stderr || '');
    const duration = Date.now() - startTime;

    const envelope = DiagnosticStreamer.format(rawOutput, {
      stage: 'PreCommit',
      toolName: 'lefthook',
      executionTimeMs: duration,
    });

    const passed = (lefthookRes.status === 0) && envelope.summary.total_errors === 0;

    return {
      passed,
      exitCode: passed ? 0 : (lefthookRes.status || 1),
      envelope,
      rawOutput,
    };
  }

  private runPrePush(startTime: number): RunResult {
    const lefthookRes = this.execCommand('npx', ['lefthook', 'run', 'pre-push']);
    const rawOutput = (lefthookRes.stdout || '') + (lefthookRes.stderr || '');
    const duration = Date.now() - startTime;

    const envelope = DiagnosticStreamer.format(rawOutput, {
      stage: 'PrePush',
      toolName: 'lefthook',
      executionTimeMs: duration,
    });

    const passed = (lefthookRes.status === 0) && envelope.summary.total_errors === 0;

    return {
      passed,
      exitCode: passed ? 0 : (lefthookRes.status || 1),
      envelope,
      rawOutput,
    };
  }

  private execCommand(command: string, args: string[]) {
    try {
      return spawnSync(command, args, {
        cwd: this.rootPath,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30000,
      });
    } catch (err: any) {
      return {
        status: 1,
        stdout: '',
        stderr: err?.message || String(err),
      };
    }
  }

  private normalizeStage(stage: string): GateStage {
    const s = stage.toLowerCase().replace(/[^a-z]/g, '');
    if (s.includes('post') || s.includes('edit')) return 'PostFileEdit';
    if (s.includes('push')) return 'PrePush';
    if (s.includes('ci')) return 'CI';
    return 'PreCommit';
  }
}

export function runGate(options: RunOptions): RunResult {
  return new GateRunner(options.cwd).run(options);
}
