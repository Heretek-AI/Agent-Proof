/**
 * @file src/cli.ts
 * @description Main command-line interface entrypoint for @heretek-ai/agent-proof.
 *
 * Dispatches CLI commands:
 * - init: Initialize mechanical hard gates in target repository
 * - detect: Run multi-stack inspection and print findings
 * - run <stage>: Execute a specific gate stage (post-edit, pre-commit, pre-push)
 * - freeze: Freeze test suites and specifications against Builder modifications (Proof-Loop)
 * - unfreeze: Unfreeze specifications for administrative test updates
 * - sanitize: Sanitize raw log/tool streams to neutralize Agentjacking payloads
 * - attest: Generate an in-toto compliant cryptographic Ed25519 provenance receipt
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
import { ByteFence } from './broker/byteFence.js';
import { LSPSanitizer } from './sanitizer/lspSanitizer.js';
import { ProvenanceEngine } from './attestation/provenance.js';
import { SarifStreamer } from './formatter/sarifStream.js';

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
  freeze [dir]         Freeze test suites & specifications against Builder modifications
  unfreeze [dir]       Unfreeze specifications for authorized test updates
  sanitize [file]      Sanitize raw log/tool streams to neutralize Agentjacking payloads
  attest [dir]         Generate signed in-toto Ed25519 provenance attestation receipt
  lock [dir]           Lock governance files with read-only permissions (chmod 0444)
  unlock [dir]         Unlock governance files for administrative editing (chmod 0644)
  status [dir]         Display permission and lock status of governance configurations

OPTIONS:
  -f, --force          Overwrite existing configuration files during init
  --sarif              Output diagnostics in SARIF v2.1.0 format
  -v, --version        Show CLI version
  -h, --help           Show this help message

EXAMPLES:
  $ npx @heretek-ai/agent-proof init
  $ npx @heretek-ai/agent-proof run pre-commit
  $ npx @heretek-ai/agent-proof freeze
  $ npx @heretek-ai/agent-proof attest
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
      console.log(`   • Detected Stacks: ${detection.summary.primaryStacks.join(', ')} (${detection.summary.totalIndicators} signature files)`);

      // 2. Generate Configurations
      console.log(`⚙️  [2/4] Generating multi-tier mechanical governance configurations...`);
      const genResult = generateConfigs(detection, {
        cwd: targetDir,
        overwrite: flags.has('-f') || flags.has('--force'),
      });
      console.log(`   • Emitted ${genResult.writtenFiles.length} configs: ${genResult.writtenFiles.join(', ')}`);
      if (genResult.skippedFiles.length > 0) {
        console.log(`   • Skipped existing: ${genResult.skippedFiles.join(', ')} (use -f to overwrite)`);
      }

      // 3. Install Git Hooks
      console.log(`🪝 [3/4] Installing mechanical Git pre-commit & pre-push hooks...`);
      const hookResult = installHooks({ cwd: targetDir });
      console.log(`   • ${hookResult.message}`);

      // 4. Lock Governance Permissions (chmod 0444)
      console.log(`🛡️  [4/4] Enforcing POSIX read-only lock-in (chmod 0444)...`);
      const lockResult = lockGovernance(targetDir);
      console.log(`   • Locked ${lockResult.lockedFiles.length} files: ${lockResult.lockedFiles.join(', ')}`);

      console.log(`\n✅ Repository is now Agent-Proof! Mechanical hard gates are active.\n`);
      break;
    }

    // -------------------------------------------------------------------------
    // DETECT: Inspect stack without file modifications
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
        if (flags.has('--sarif')) {
          console.log(SarifStreamer.formatSarifJson(envelope.diagnostics));
        } else {
          console.log(JSON.stringify(envelope, null, 2));
        }
        if (envelope.status === 'GATE_FAILED') process.exit(1);
      } else if (stage === 'pre-commit') {
        const envelope = runner.runPreCommit();
        if (flags.has('--sarif')) {
          console.log(SarifStreamer.formatSarifJson(envelope.diagnostics));
        } else {
          console.log(JSON.stringify(envelope, null, 2));
        }
        if (envelope.status === 'GATE_FAILED') process.exit(1);
      } else if (stage === 'pre-push') {
        const envelope = runner.runPrePush();
        if (flags.has('--sarif')) {
          console.log(SarifStreamer.formatSarifJson(envelope.diagnostics));
        } else {
          console.log(JSON.stringify(envelope, null, 2));
        }
        if (envelope.status === 'GATE_FAILED') process.exit(1);
      } else {
        console.error(`Unknown stage: ${stage}. Expected: post-edit, pre-commit, pre-push`);
        process.exit(1);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // FREEZE / UNFREEZE: Proof-Loop role separation & test freezing
    // -------------------------------------------------------------------------
    case 'freeze': {
      const fence = new ByteFence(targetDir);
      const config = fence.freezeSpecifications();
      console.log(`🧊 Frozen ${Object.keys(config.pathDigests).length} test and spec files under proof-loop role separation.`);
      break;
    }

    case 'unfreeze': {
      const fence = new ByteFence(targetDir);
      const unfrozen = fence.unfreezeSpecifications();
      if (unfrozen) {
        console.log(`🔓 Unfrozen test specifications for authorized administrative updates.`);
      } else {
        console.log(`⚪ No active frozen specification manifest found.`);
      }
      break;
    }

    // -------------------------------------------------------------------------
    // SANITIZE: Agentjacking log sanitization
    // -------------------------------------------------------------------------
    case 'sanitize': {
      const filePath = args[1];
      let content = '';
      if (filePath && fs.existsSync(filePath)) {
        content = fs.readFileSync(filePath, 'utf-8');
      } else {
        content = fs.readFileSync(0, 'utf-8'); // Read stdin
      }
      const sanitized = LSPSanitizer.sanitize(content);
      console.log(LSPSanitizer.wrapPassiveContract(sanitized));
      break;
    }

    // -------------------------------------------------------------------------
    // ATTEST: In-toto Ed25519 Provenance Attestation
    // -------------------------------------------------------------------------
    case 'attest': {
      const attestation = ProvenanceEngine.createAttestation({ cwd: targetDir });
      console.log(JSON.stringify(attestation, null, 2));
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
