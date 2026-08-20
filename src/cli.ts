/**
 * @file src/cli.ts
 * @description Main command-line interface entrypoint for @heretek-ai/agent-proof.
 *
 * Dispatches CLI commands:
 * - init: Initialize mechanical hard gates in target repository
 * - detect: Run multi-stack inspection and print findings
 * - run <stage>: Execute a specific gate stage (post-edit, pre-commit, pre-push)
 * - lock: Apply read-only permissions (0444) to governance configurations
 * - unlock: Restore standard permissions (0644) for administrative edits
 * - status: Print current permission and lock status of governance files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectStack } from './detector/stackDetector.js';
import { generateConfigs } from './generator/configGenerator.js';
import { installHooks } from './installer/hookInstaller.js';
import { GateLock, lockGovernance, unlockGovernance } from './installer/lockin.js';
import { GateRunner } from './runner/gateRunner.js';

/**
 * Retrieve the current package version dynamically from package.json
 */
function getPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version) return pkg.version;
    }
  } catch {}
  return '1.0.0';
}

/**
 * Display help text detailing usage, subcommands, and flags
 */
function printHelp() {
  console.log(`
🛡️  @heretek-ai/agent-proof — Mechanical Hard-Gate CLI for AI Code Governance

USAGE:
  $ agent-proof <command> [options]
  $ agent-gate <command> [options]

COMMANDS:
  init [dir]           Initialize 3-tier mechanical hard gates in target repository
  detect [dir]         Inspect repository architecture and report detected stacks
  run <stage> [file]   Execute a mechanical gate stage (post-edit, pre-commit, pre-push)
  lock [dir]           Lock governance files with read-only permissions (chmod 0444)
  unlock [dir]         Unlock governance files for administrative editing (chmod 0644)
  status [dir]         Display permission and lock status of governance configurations

OPTIONS:
  -f, --force          Overwrite existing configuration files during init
  -v, --version        Show CLI version
  -h, --help           Show this help message

EXAMPLES:
  $ npx @heretek-ai/agent-proof init
  $ npx @heretek-ai/agent-proof run pre-commit
  $ npx @heretek-ai/agent-proof run post-edit src/auth.ts
  $ npx @heretek-ai/agent-proof status
`);
}

/**
 * CLI Main Dispatcher
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = argv.filter(a => !a.startsWith('-'));
  const flags = new Set(argv.filter(a => a.startsWith('-')));

  if (flags.has('-h') || flags.has('--help') || (args.length === 0 && flags.size === 0)) {
    printHelp();
    return;
  }

  if (flags.has('-v') || flags.has('--version')) {
    console.log(`@heretek-ai/agent-proof v${getPackageVersion()}`);
    return;
  }

  const command = args[0] || 'init';
  const targetDir = args[1] && !['post-edit', 'pre-commit', 'pre-push'].includes(args[1])
    ? path.resolve(args[1])
    : process.cwd();

  switch (command) {
    // -------------------------------------------------------------------------
    // INIT: Initialize full 3-tier hard gates
    // -------------------------------------------------------------------------
    case 'init': {
      console.log(`\n🔒 Agent-Proof Mechanical Hard-Gate Initializer`);
      console.log(`📂 Repository Root: ${targetDir}\n`);

      // 1. Multi-Stack Inspection
      console.log(`🔍 [1/4] Inspecting repository multi-stack architecture...`);
      const detection = detectStack(targetDir);
      console.log(`   • Stacks detected: ${detection.summary.primaryStacks.join(', ') || 'Generic'}`);
      if (detection.jsTs.detected) {
        console.log(`     - JS/TS: ${detection.jsTs.files.join(', ')} (TypeScript: ${detection.jsTs.hasTypeScript ? 'Yes' : 'No'}, Biome: ${detection.jsTs.hasBiome ? 'Yes' : 'No'})`);
      }
      if (detection.python.detected) {
        console.log(`     - Python: ${detection.python.files.join(', ')} (Ruff: ${detection.python.hasRuffConfig ? 'Yes' : 'No'})`);
      }
      if (detection.infra.detected) {
        console.log(`     - Infra/CI: ${[...detection.infra.workflowFiles, ...detection.infra.dockerFiles].join(', ')}`);
      }
      if (detection.agentHarness.detected) {
        console.log(`     - Agent Harness: ${detection.agentHarness.files.join(', ')}`);
      }

      // 2. Multi-Tier Config Emission
      console.log(`\n⚙️  [2/4] Emitting multi-tier pipeline governance configs...`);
      const overwrite = flags.has('-f') || flags.has('--force');
      const genResult = generateConfigs(detection, { cwd: targetDir, overwrite });
      for (const written of genResult.writtenFiles) {
        console.log(`   ✅ Created ${written}`);
      }
      for (const skipped of genResult.skippedFiles) {
        console.log(`   ⏩ Skipped existing ${skipped} (use --force to overwrite)`);
      }

      // 3. Git Hooks Installation
      console.log(`\n🪝 [3/4] Initializing mechanical git hooks...`);
      const hookResult = installHooks(targetDir);
      console.log(`   • ${hookResult.message}`);
      if (hookResult.installedHooks.length > 0) {
        console.log(`   • Active hooks: ${hookResult.installedHooks.join(', ')}`);
      }

      // 4. Governance Lock-in
      console.log(`\n🛡️  [4/4] Locking governance controls...`);
      const lockResult = lockGovernance(targetDir);
      if (lockResult.lockedFiles.length > 0) {
        console.log(`   🔒 Immutable read-only lock applied to: ${lockResult.lockedFiles.join(', ')}`);
      }

      console.log(`\n✨ Repository is now Agent-Proof! Sub-second mechanical gates active.`);
      console.log(`   Stage 1: Agent PostFileEdit tool interceptor (.claude/hooks.json)`);
      console.log(`   Stage 2: Staged files pre-commit hard gate (< 2.0s via Lefthook)`);
      console.log(`   Stage 3: Pre-push / CI codebase graph & shadow API audit\n`);
      break;
    }

    // -------------------------------------------------------------------------
    // DETECT: Inspect and print detected stacks
    // -------------------------------------------------------------------------
    case 'detect': {
      const detection = detectStack(targetDir);
      console.log(JSON.stringify(detection, null, 2));
      break;
    }

    // -------------------------------------------------------------------------
    // RUN: Execute a specific gate stage
    // -------------------------------------------------------------------------
    case 'run': {
      const stage = args[1] || 'pre-commit';
      const runner = new GateRunner({ cwd: targetDir });

      if (stage === 'post-edit') {
        const filePath = args[2];
        if (!filePath) {
          console.error('Error: filePath argument required for post-edit stage');
          process.exit(1);
        }
        const envelope = runner.runPostEdit(filePath);
        console.log(JSON.stringify(envelope, null, 2));
        if (envelope.status === 'GATE_FAILED') process.exit(1);
      } else if (stage === 'pre-commit') {
        const envelope = runner.runPreCommit();
        console.log(JSON.stringify(envelope, null, 2));
        if (envelope.status === 'GATE_FAILED') process.exit(1);
      } else if (stage === 'pre-push') {
        const envelope = runner.runPrePush();
        console.log(JSON.stringify(envelope, null, 2));
        if (envelope.status === 'GATE_FAILED') process.exit(1);
      } else {
        console.error(`Unknown stage: ${stage}. Expected: post-edit, pre-commit, pre-push`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // LOCK / UNLOCK / STATUS: POSIX governance permissions
    // -------------------------------------------------------------------------
    case 'lock': {
      const result = lockGovernance(targetDir);
      console.log(`🔒 Locked ${result.lockedFiles.length} governance files: ${result.lockedFiles.join(', ')}`);
      break;
    }

    case 'unlock': {
      const result = unlockGovernance(targetDir);
      console.log(`🔓 Unlocked ${result.lockedFiles.length} governance files: ${result.lockedFiles.join(', ')}`);
      break;
    }

    case 'status': {
      const lock = new GateLock({ cwd: targetDir });
      const statuses = lock.checkStatus();
      console.log(`\n🛡️  Governance Configuration Status:`);
      for (const s of statuses) {
        if (!s.exists) {
          console.log(`   ⚪ [NOT FOUND] ${s.path}`);
        } else if (s.isLocked) {
          console.log(`   🔒 [LOCKED] ${s.path} (mode: ${s.mode})`);
        } else {
          console.log(`   ⚠️  [UNLOCKED] ${s.path} (mode: ${s.mode})`);
        }
      }
      console.log('');
      break;
    }

    default: {
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
  }
}

// Execute main if invoked directly from CLI
if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
  main().catch(err => {
    console.error(`Fatal CLI Error:`, err);
    process.exit(1);
  });
}
