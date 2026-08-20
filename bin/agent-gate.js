#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Platform-Specific Zero-Dependency Binary Launcher
 * Directly delegates execution to native architecture binary when available,
 * or seamlessly falls back to bundled JavaScript CLI engine.
 */

const PLATFORM_MAP = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'win32',
};

const ARCH_MAP = {
  x64: 'x64',
  arm64: 'arm64',
};

function getNativeBinaryPath() {
  const platform = PLATFORM_MAP[process.platform];
  const arch = ARCH_MAP[process.arch];

  if (!platform || !arch) {
    return null;
  }

  const binaryNames = platform === 'win32'
    ? ['agent-proof.exe', 'agent-gate.exe']
    : ['agent-proof', 'agent-gate'];

  const packageNames = [
    `@heretek-ai/binary-${platform}-${arch}`,
    `@agent-proof/binary-${platform}-${arch}`,
    `@agent-gate/binary-${platform}-${arch}`,
  ];

  for (const packageName of packageNames) {
    for (const binaryName of binaryNames) {
      const candidates = [
        // 1. Direct optionalDependency in node_modules
        path.join(__dirname, '..', 'node_modules', packageName, 'bin', binaryName),
        // 2. Hoisted node_modules (monorepo / global)
        path.join(__dirname, '..', '..', packageName, 'bin', binaryName),
        // 3. Local architecture build directory
        path.join(__dirname, 'native', `${platform}-${arch}`, binaryName),
      ];

      for (const candidate of candidates) {
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
          }
        } catch {
          // ignore stat errors
        }
      }
    }
  }

  return null;
}

function launch() {
  const nativeBinary = getNativeBinaryPath();
  const args = process.argv.slice(2);

  if (nativeBinary) {
    try {
      execFileSync(nativeBinary, args, {
        stdio: 'inherit',
        env: process.env,
      });
      process.exit(0);
    } catch (err) {
      if (err.status !== undefined && err.status !== null) {
        process.exit(err.status);
      } else if (err.signal) {
        process.kill(process.pid, err.signal);
      } else {
        console.error(`[agent-proof] Native binary execution failed: ${err.message}`);
        process.exit(1);
      }
    }
  } else {
    // Fallback to bundled JavaScript CLI engine
    const distCli = path.join(__dirname, '..', 'dist', 'cli.js');
    const distCliCjs = path.join(__dirname, '..', 'dist', 'cli.cjs');

    if (fs.existsSync(distCliCjs)) {
      try {
        const { runCli } = require(distCliCjs);
        runCli(args).then(code => process.exit(code ?? 0)).catch(err => {
          console.error(err);
          process.exit(1);
        });
      } catch (err) {
        console.error(`[agent-proof] JS fallback failed: ${err.message}`);
        process.exit(1);
      }
    } else if (fs.existsSync(distCli)) {
      import(distCli).then(({ runCli }) => {
        return runCli(args);
      }).then(code => {
        process.exit(code ?? 0);
      }).catch(err => {
        console.error(`[agent-proof] JS fallback failed: ${err.message}`);
        process.exit(1);
      });
    } else {
      console.error('[agent-proof] Error: Neither native binary nor built dist/cli.js was found.');
      console.error('Please run `npm run build` first.');
      process.exit(1);
    }
  }
}

launch();
