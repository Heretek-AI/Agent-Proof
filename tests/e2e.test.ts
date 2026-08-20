import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { unlockGovernance } from '../src/installer/index.js';
import { formatDiagnostics } from '../src/formatter/index.js';

describe('E2E Repository Hard-Gate Initialization & Slop Interception', () => {
  let tempDir: string;
  const rootDir = path.resolve(__dirname, '..');
  const binScriptPath = path.join(rootDir, 'bin', 'agent-gate.js');

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-gate-e2e-test-'));

    // 1. Initialize git in mock repo
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });

    // 2. Setup mock multi-stack repository files
    // JS/TS stack
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'mock-polyglot-repo',
        version: '1.0.0',
        scripts: { build: 'tsc' },
        devDependencies: { typescript: '^5.0.0' },
      }, null, 2)
    );
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    // Python stack
    fs.writeFileSync(
      path.join(tempDir, 'pyproject.toml'),
      '[project]\nname = "mock-backend"\nversion = "0.1.0"\n'
    );

    // GitHub Workflows & Infra
    const wfDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'ci.yml'), 'name: CI\non: [push]\n');

    // Agent Harness
    const skillsDir = path.join(tempDir, '.claude', 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'test-runner.md'), '---\nname: "test-runner"\ndescription: "Run tests"\n---\n');
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '---\nname: "agent-root"\ndescription: "Root skill"\n---\n');

    // Create simulated slop code files
    const srcDir = path.join(tempDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Simulated TypeScript slop: empty catch block & any cast
    fs.writeFileSync(
      path.join(srcDir, 'auth_slop.ts'),
      `export async function login(token: any) {
  try {
    const payload = JSON.parse(token);
    return payload;
  } catch (e) {
    // Slop: swallowed error
  }
}`
    );

    // Simulated Python slop: bare except & unused import
    fs.writeFileSync(
      path.join(tempDir, 'backend_slop.py'),
      `import os
import sys

def process_data(data):
    try:
        return data["value"]
    except:
        pass
`
    );
  });

  afterEach(() => {
    try {
      unlockGovernance(tempDir);
    } catch {
      // ignore
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('runs npx create-agent-gate (bin/agent-gate.js init), generates configs, and locks gates', () => {
    // Execute CLI in mock repository
    const output = execFileSync(process.execPath, [binScriptPath, 'init', tempDir], {
      encoding: 'utf-8',
    });

    expect(output).toContain('Agent-Proof Mechanical Hard-Gate Initializer');
    expect(output).toContain('Stacks detected: JavaScript/TypeScript, Python, Workflows/Infra, Agent Harness');
    expect(output).toContain('Created lefthook.yml');
    expect(output).toContain('Created .claude/hooks.json');
    expect(output).toContain('Created .claude/settings.json');
    expect(output).toContain('Created biome.json');
    expect(output).toContain('Created ruff.toml');
    expect(output).toContain('Created .aislop/config.yml');

    // Verify files exist on disk
    expect(fs.existsSync(path.join(tempDir, 'lefthook.yml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.claude', 'hooks.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.claude', 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'biome.json'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'ruff.toml'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.aislop', 'config.yml'))).toBe(true);

    // Verify git hooks installed
    expect(fs.existsSync(path.join(tempDir, '.git', 'hooks', 'pre-commit'))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, '.git', 'hooks', 'pre-push'))).toBe(true);

    // Verify immutable permissions applied
    const hooksStats = fs.statSync(path.join(tempDir, '.claude', 'hooks.json'));
    // Read-only check (user write bit is not set: 0o200)
    expect((hooksStats.mode & 0o200) === 0).toBe(true);
  });

  it('intercepts simulated slop and produces an LSP-compliant diagnostic envelope with repair tokens', () => {
    // Simulate raw failure output from aislop detecting the empty catch in auth_slop.ts
    const simulatedAislopStderr = `src/auth_slop.ts:6:5: [AI_SLOP_SWALLOWED_ERROR] Empty catch block silently suppresses authentication error.`;

    const envelope = formatDiagnostics(simulatedAislopStderr, {
      toolName: 'aislop',
      stage: 'PreCommit',
    });

    expect(envelope.$schema).toBe('https://json.schemastore.org/lsif.json');
    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.summary.total_errors).toBe(1);
    expect(envelope.summary.gate_stage).toBe('PreCommit');

    const diag = envelope.diagnostics[0];
    expect(diag.source).toBe('aislop');
    expect(diag.rule_id).toBe('AI_SLOP_SWALLOWED_ERROR');
    expect(diag.file_path).toBe('src/auth_slop.ts');
    expect(diag.range?.start.line).toBe(6);
    expect(diag.repair_instruction?.action).toBe('REWRITE_BLOCK');
    expect(diag.repair_instruction?.repair_tokens.length).toBeGreaterThan(0);
  });

  it('intercepts simulated Python slop and produces Ruff diagnostics with repair tokens', () => {
    // Simulate raw failure output from ruff detecting bare except and unused imports in backend_slop.py
    const simulatedRuffStderr = `backend_slop.py:1:1: F401 [*] 'os' imported but unused
backend_slop.py:2:1: F401 [*] 'sys' imported but unused
backend_slop.py:7:5: E722 Do not use bare 'except'`;

    const envelope = formatDiagnostics(simulatedRuffStderr, {
      toolName: 'ruff',
      stage: 'PreCommit',
    });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.summary.total_errors).toBe(3);

    const f401 = envelope.diagnostics.find(d => d.rule_id === 'F401');
    expect(f401?.file_path).toBe('backend_slop.py');
    expect(f401?.repair_instruction?.action).toBe('DELETE_LINE');

    const e722 = envelope.diagnostics.find(d => d.rule_id === 'E722');
    expect(e722?.repair_instruction?.action).toBe('REWRITE_BLOCK');
    expect(e722?.repair_instruction?.repair_tokens[0]).toContain('except Exception');
  });
});
