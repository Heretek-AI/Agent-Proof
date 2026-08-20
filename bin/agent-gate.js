#!/usr/bin/env node
/**
 * @file bin/agent-gate.js
 * @description Zero-dependency platform-specific binary launcher with JS fallback.
 *
 * Execution Resolution Flow:
 * 1. Checks for native compiled architecture binary in optionalDependencies
 *    (@heretek-ai/binary-*, @agent-proof/binary-*, @agent-gate/binary-*).
 * 2. If present, delegates directly via `execFileSync` without invoking npm.
 * 3. Otherwise, falls back to executing the bundled JavaScript CLI in `dist/cli.js`.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Determine current OS platform and CPU architecture
const platform = process.platform;
const arch = process.arch;

// Binary package naming candidates
const packageNames = [
  `@heretek-ai/binary-${platform}-${arch}`,
  `@agent-proof/binary-${platform}-${arch}`,
  `@agent-gate/binary-${platform}-${arch}`,
];

// Binary executable filename
const binaryName = platform === 'win32' ? 'agent-proof.exe' : 'agent-proof';

let nativeBinaryPath = null;

// Search for native binary across candidate package names
for (const pkg of packageNames) {
  try {
    const pkgPath = require.resolve(`${pkg}/package.json`);
    const binDir = path.dirname(pkgPath);
    const candidatePath = path.join(binDir, 'bin', binaryName);
    if (fs.existsSync(candidatePath)) {
      nativeBinaryPath = candidatePath;
      break;
    }
  } catch {
    // Package not installed in node_modules, continue searching
  }
}

// Delegate execution
if (nativeBinaryPath) {
  // Execute native compiled binary directly
  try {
    execFileSync(nativeBinaryPath, process.argv.slice(2), {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    if (err.status !== undefined) {
      process.exit(err.status);
    }
    console.error(`Failed to execute native binary at ${nativeBinaryPath}:`, err.message);
    process.exit(1);
  }
} else {
  // Fall back to JavaScript CLI implementation in dist/
  const cliCjs = path.join(__dirname, '..', 'dist', 'cli.js');
  const cliMjs = path.join(__dirname, '..', 'dist', 'cli.mjs');

  if (fs.existsSync(cliCjs)) {
    const { main } = require(cliCjs);
    main(process.argv.slice(2)).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else if (fs.existsSync(cliMjs)) {
    import(cliMjs).then(({ main }) => {
      main(process.argv.slice(2)).catch(err => {
        console.error(err);
        process.exit(1);
      });
    }).catch(err => {
      console.error('Failed to load CLI bundle:', err);
      process.exit(1);
    });
  } else {
    console.error('Error: Neither native binary nor bundled CLI found. Please run `npm run build`.');
    process.exit(1);
  }
}
