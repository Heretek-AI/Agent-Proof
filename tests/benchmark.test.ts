import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectStack } from '../src/detector/stackDetector';
import { ConfigGenerator } from '../src/generator/configGenerator';
import { DiagnosticStreamer } from '../src/formatter/diagnosticStream';
import { lockGovernance, unlockGovernance } from '../src/installer/lockin';

describe('Performance & Latency SLA Benchmarks', () => {
  it('completes multi-stack architecture detection in < 30ms', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-detect-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module test');
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '');
      fs.writeFileSync(path.join(tempDir, 'Dockerfile'), 'FROM node');

      const start = performance.now();
      const detection = detectStack(tempDir);
      const duration = performance.now() - start;

      expect(detection.jsTs.detected).toBe(true);
      expect(detection.python.detected).toBe(true);
      expect(detection.go.detected).toBe(true);
      expect(detection.rust.detected).toBe(true);
      expect(duration).toBeLessThan(30); // SLA < 30ms
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('completes config codegen for polyglot repository in < 15ms', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-gen-'));
    try {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
      const detection = detectStack(tempDir);

      const start = performance.now();
      const generator = new ConfigGenerator({ cwd: tempDir });
      const configs = generator.generate(detection);
      const duration = performance.now() - start;

      expect(configs.length).toBeGreaterThanOrEqual(4);
      expect(duration).toBeLessThan(15); // SLA < 15ms
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('streams and parses 1,000 LSP diagnostic lines in < 25ms', () => {
    const lines = [];
    for (let i = 1; i <= 1000; i++) {
      lines.push(`src/file_${i}.ts:${i}:1: [AI_SLOP_SWALLOWED_ERROR] Empty catch block.`);
    }
    const rawOutput = lines.join('\n');

    const start = performance.now();
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'aislop', output: rawOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );
    const duration = performance.now() - start;

    expect(envelope.diagnostics.length).toBe(1000);
    expect(duration).toBeLessThan(25); // SLA < 25ms
  });

  it('applies and verifies chmod 0444 POSIX lock in < 10ms', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-lock-'));
    try {
      const files = ['lefthook.yml', '.claude/hooks.json', 'biome.json', 'ruff.toml'];
      for (const f of files) {
        const full = path.join(tempDir, f);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, 'test');
      }

      const start = performance.now();
      const lockRes = lockGovernance(tempDir);
      const duration = performance.now() - start;

      expect(lockRes.lockedFiles.length).toBe(4);
      expect(duration).toBeLessThan(10); // SLA < 10ms

      unlockGovernance(tempDir);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
