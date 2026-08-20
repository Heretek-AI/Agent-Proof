import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { GateRunner } from '../src/runner/gateRunner';
import { generateConfigs } from '../src/generator/configGenerator';
import { detectStack } from '../src/detector/stackDetector';

describe('GateRunner Mechanical Stage Execution', () => {
  let tempDir: string;
  let runner: GateRunner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-proof-runner-'));
    // Setup git repo
    execFileSync('git', ['init', tempDir], { stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'RunnerTester'], { cwd: tempDir });
    execFileSync('git', ['config', 'user.email', 'runner@tester.local'], { cwd: tempDir });

    // Setup basic TS stack
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    const detection = detectStack(tempDir);
    generateConfigs(detection, { cwd: tempDir, overwrite: true });
    runner = new GateRunner({ cwd: tempDir });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('executes post-edit stage on clean file without error', () => {
    const testFile = path.join(tempDir, 'src', 'calc.ts');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, 'export function add(a: number, b: number): number { return a + b; }\n');

    const envelope = runner.runPostEdit(testFile);
    expect(envelope.summary.gate_stage).toBe('PostFileEdit');
  });

  it('executes pre-commit stage and returns diagnostic envelope', () => {
    const testFile = path.join(tempDir, 'src', 'data.ts');
    fs.mkdirSync(path.dirname(testFile), { recursive: true });
    fs.writeFileSync(testFile, 'export function getVal() { return 42; }\n');
    execFileSync('git', ['add', testFile], { cwd: tempDir });

    const envelope = runner.runPreCommit();
    expect(envelope.summary.gate_stage).toBe('PreCommit');
    expect(envelope.$schema).toBe('https://json.schemastore.org/lsif.json');
  });

  it('executes pre-push stage and returns diagnostic envelope', () => {
    const envelope = runner.runPrePush();
    expect(envelope.summary.gate_stage).toBe('PrePush');
  });
});
