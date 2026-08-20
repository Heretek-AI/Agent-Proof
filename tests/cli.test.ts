import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';

describe('CLI Command Dispatcher Integration', () => {
  const rootDir = path.resolve(__dirname, '..');
  const binScript = path.join(rootDir, 'bin', 'agent-proof.js');
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-proof-cli-'));
  });

  afterEach(() => {
    try {
      execFileSync(process.execPath, [binScript, 'unlock', tempDir], { stdio: 'ignore' });
    } catch {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('prints help message with --help flag', () => {
    const output = execFileSync(process.execPath, [binScript, '--help'], { encoding: 'utf-8' });
    expect(output).toContain('Mechanical Hard-Gate CLI');
    expect(output).toContain('COMMANDS:');
    expect(output).toContain('init [dir]');
    expect(output).toContain('detect [dir]');
  });

  it('prints version with --version flag', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
    const output = execFileSync(process.execPath, [binScript, '--version'], { encoding: 'utf-8' });
    expect(output).toContain(`@heretek-ai/agent-proof v${pkg.version}`);
  });

  it('runs detect command on target directory', () => {
    fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');
    const output = execFileSync(process.execPath, [binScript, 'detect', tempDir], { encoding: 'utf-8' });
    const parsed = JSON.parse(output);
    expect(parsed.python.detected).toBe(true);
    expect(parsed.summary.primaryStacks).toContain('Python');
  });

  it('runs init command, generates configs, and locks them with chmod 0444', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'cli-test' }));
    const output = execFileSync(process.execPath, [binScript, 'init', tempDir], { encoding: 'utf-8' });
    expect(output).toContain('Repository is now Agent-Proof!');

    // Status check
    const statusOutput = execFileSync(process.execPath, [binScript, 'status', tempDir], { encoding: 'utf-8' });
    expect(statusOutput).toContain('[LOCKED] .claude/hooks.json');
    expect(statusOutput).toContain('[LOCKED] lefthook.yml');
  });

  it('unlocks and relocks governance configurations', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'cli-test' }));
    execFileSync(process.execPath, [binScript, 'init', tempDir], { stdio: 'ignore' });

    // Unlock
    const unlockOutput = execFileSync(process.execPath, [binScript, 'unlock', tempDir], { encoding: 'utf-8' });
    expect(unlockOutput).toContain('Unlocked');

    // Verify writable
    const hooksPath = path.join(tempDir, '.claude', 'hooks.json');
    fs.writeFileSync(hooksPath, '{"unlocked": true}');

    // Lock again
    const lockOutput = execFileSync(process.execPath, [binScript, 'lock', tempDir], { encoding: 'utf-8' });
    expect(lockOutput).toContain('Locked');
  });
});
