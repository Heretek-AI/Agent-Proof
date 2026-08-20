import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('Platform-Specific Packaging & Launcher', () => {
  const rootDir = path.resolve(__dirname, '..');
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const binScriptPath = path.join(rootDir, 'bin', 'agent-proof.js');
  const binGateScriptPath = path.join(rootDir, 'bin', 'agent-gate.js');

  it('has package.json configured with zero runtime dependencies and valid bin entrypoints', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

    expect(pkg.name).toBe('@heretek-ai/agent-proof');
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin['agent-proof']).toBe('./bin/agent-proof.js');
    expect(pkg.bin['create-agent-proof']).toBe('./bin/agent-proof.js');
    expect(pkg.bin['agent-gate']).toBe('./bin/agent-gate.js');
    expect(pkg.bin['create-agent-gate']).toBe('./bin/agent-gate.js');

    // Confirm zero runtime dependencies for lean distribution
    expect(pkg.dependencies).toBeUndefined();
  });

  it('verifies bin/agent-proof.js and bin/agent-gate.js handle CLI options via fallback', () => {
    const content = fs.readFileSync(binGateScriptPath, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);

    // Run --version through bin/agent-proof.js
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const output = execFileSync(process.execPath, [binScriptPath, '--version'], {
      encoding: 'utf-8',
    });
    expect(output).toContain(`@heretek-ai/agent-proof v${pkg.version}`);

    // Run --help through bin/agent-gate.js
    const helpOutput = execFileSync(process.execPath, [binGateScriptPath, '--help'], {
      encoding: 'utf-8',
    });
    expect(helpOutput).toContain('Mechanical Hard-Gate');
  });
});
