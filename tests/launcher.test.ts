import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

describe('Platform-Specific Binary Packaging & Launcher', () => {
  const rootDir = path.resolve(__dirname, '..');
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const binScriptPath = path.join(rootDir, 'bin', 'agent-proof.js');
  const binGateScriptPath = path.join(rootDir, 'bin', 'agent-gate.js');

  it('has package.json configured with complete optionalDependencies matrix pinning', () => {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));

    expect(pkg.name).toBe('@heretek-ai/agent-proof');
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin['agent-proof']).toBe('./bin/agent-proof.js');
    expect(pkg.bin['create-agent-proof']).toBe('./bin/agent-proof.js');
    expect(pkg.bin['agent-gate']).toBe('./bin/agent-gate.js');
    expect(pkg.bin['create-agent-gate']).toBe('./bin/agent-gate.js');

    const optDeps = pkg.optionalDependencies;
    expect(optDeps).toBeDefined();

    // Verify Darwin (macOS), Linux, and Windows matrices for both x64 and arm64
    expect(optDeps['@heretek-ai/binary-darwin-arm64']).toBeDefined();
    expect(optDeps['@heretek-ai/binary-darwin-x64']).toBeDefined();
    expect(optDeps['@heretek-ai/binary-linux-arm64']).toBeDefined();
    expect(optDeps['@heretek-ai/binary-linux-x64']).toBeDefined();
    expect(optDeps['@heretek-ai/binary-win32-arm64']).toBeDefined();
    expect(optDeps['@heretek-ai/binary-win32-x64']).toBeDefined();
  });

  it('verifies bin/agent-proof.js and bin/agent-gate.js handle CLI options via fallback', () => {
    const content = fs.readFileSync(binGateScriptPath, 'utf-8');
    expect(content.startsWith('#!/usr/bin/env node')).toBe(true);

    // Run --version through bin/agent-proof.js
    const output = execFileSync(process.execPath, [binScriptPath, '--version'], {
      encoding: 'utf-8',
    });
    expect(output).toContain('@heretek-ai/agent-proof v1.0.0');

    // Run --help through bin/agent-gate.js
    const helpOutput = execFileSync(process.execPath, [binGateScriptPath, '--help'], {
      encoding: 'utf-8',
    });
    expect(helpOutput).toContain('Mechanical Hard-Gate');
  });
});
