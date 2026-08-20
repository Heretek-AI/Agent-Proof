import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectStack } from './detector/index.js';
import { generateConfigs } from './generator/index.js';
import { installHooks } from './installer/index.js';
import { lockGovernance, unlockGovernance, getGovernanceStatus } from './installer/index.js';
import { formatDiagnostics, DiagnosticStreamer } from './formatter/index.js';
import { runGate } from './runner/index.js';

export async function runCli(argv: string[] = process.argv.slice(2)): Promise<number> {
  const command = argv[0] || 'init';
  const args = argv.slice(1);

  switch (command) {
    case 'init':
    case 'setup': {
      return handleInit(args);
    }

    case 'detect': {
      return handleDetect(args);
    }

    case 'run': {
      return handleRun(args);
    }

    case 'stream':
    case 'format-diagnostics': {
      return handleStream(args);
    }

    case 'lock': {
      return handleLock(args);
    }

    case 'unlock': {
      return handleUnlock(args);
    }

    case 'status': {
      return handleStatus(args);
    }

    case '--help':
    case '-h':
    case 'help': {
      printHelp();
      return 0;
    }

    case '--version':
    case '-v':
    case 'version': {
      console.log('@heretek-ai/agent-proof v1.0.0');
      return 0;
    }

    default: {
      // If run as `create-agent-gate`, treat unknown command as target directory or run init
      if (command.startsWith('-')) {
        console.error(`Unknown option: ${command}`);
        printHelp();
        return 1;
      }
      return handleInit(argv);
    }
  }
}

function handleInit(args: string[]): number {
  const cwd = args.find(a => !a.startsWith('-')) || process.cwd();
  const overwrite = args.includes('--force') || args.includes('-f');
  const noLock = args.includes('--no-lock');

  console.log('\n🔒 Agent-Proof Mechanical Hard-Gate Initializer');
  console.log(`📂 Repository Root: ${path.resolve(cwd)}\n`);

  console.log('🔍 [1/4] Inspecting repository multi-stack architecture...');
  const detection = detectStack(cwd);

  console.log(`   • Stacks detected: ${detection.summary.primaryStacks.join(', ') || 'Generic / Universal'}`);
  if (detection.jsTs.detected) console.log(`     - JS/TS: ${detection.jsTs.files.join(', ')} (TypeScript: ${detection.jsTs.hasTypeScript ? 'Yes' : 'No'}, Biome: ${detection.jsTs.hasBiome ? 'Yes' : 'No'})`);
  if (detection.python.detected) console.log(`     - Python: ${detection.python.files.join(', ')} (Ruff: ${detection.python.hasRuffConfig ? 'Yes' : 'No'})`);
  if (detection.go.detected) console.log(`     - Go: ${detection.go.files.join(', ')}`);
  if (detection.rust.detected) console.log(`     - Rust: ${detection.rust.files.join(', ')} (Workspace: ${detection.rust.isWorkspace ? 'Yes' : 'No'})`);
  if (detection.infra.detected) console.log(`     - Infra/CI: ${[...detection.infra.workflowFiles, ...detection.infra.dockerFiles].join(', ')}`);
  if (detection.agentHarness.detected) console.log(`     - Agent Harness: ${detection.agentHarness.files.join(', ')}`);

  console.log('\n⚙️  [2/4] Emitting multi-tier pipeline governance configs...');
  const genResult = generateConfigs(detection, { cwd, overwrite });
  for (const written of genResult.writtenFiles) {
    console.log(`   ✅ Created ${written}`);
  }
  for (const skipped of genResult.skippedFiles) {
    console.log(`   ⏭️  Skipped ${skipped} (already exists, use --force to overwrite)`);
  }

  console.log('\n🪝 [3/4] Initializing mechanical git hooks...');
  const hookResult = installHooks({ cwd });
  console.log(`   • ${hookResult.message}`);
  if (hookResult.installedHooks.length > 0) {
    console.log(`   • Active hooks: ${hookResult.installedHooks.join(', ')}`);
  }

  console.log('\n🛡️  [4/4] Locking governance controls...');
  if (!noLock) {
    const lockRes = lockGovernance(cwd);
    if (lockRes.lockedFiles.length > 0) {
      console.log(`   🔒 Immutable read-only lock applied to: ${lockRes.lockedFiles.join(', ')}`);
    }
  } else {
    console.log('   ⚠️  Governance locking skipped (--no-lock specified).');
  }

  console.log('\n✨ Repository is now Agent-Proof! Sub-second mechanical gates active.');
  console.log('   Stage 1: Agent PostFileEdit tool interceptor (.claude/hooks.json)');
  console.log('   Stage 2: Staged files pre-commit hard gate (< 2.0s via Lefthook)');
  console.log('   Stage 3: Pre-push / CI codebase graph & shadow API audit\n');

  return 0;
}

function handleDetect(args: string[]): number {
  const cwd = args.find(a => !a.startsWith('-')) || process.cwd();
  const isJson = args.includes('--json');
  const detection = detectStack(cwd);

  if (isJson) {
    console.log(JSON.stringify(detection, null, 2));
  } else {
    console.log('Stack Detection Summary:');
    console.log(JSON.stringify(detection.summary, null, 2));
    console.log('\nDetailed Breakdown:');
    console.log(JSON.stringify({
      jsTs: detection.jsTs,
      python: detection.python,
      go: detection.go,
      rust: detection.rust,
      infra: detection.infra,
      agentHarness: detection.agentHarness,
    }, null, 2));
  }
  return 0;
}

function handleRun(args: string[]): number {
  const stage = args[0] || 'pre-commit';
  const filePath = args.find((a, idx) => idx > 0 && !a.startsWith('-'));
  const isJson = args.includes('--json') || args.includes('--lsp');
  const cwd = process.cwd();

  const result = runGate({
    stage: stage as any,
    filePath,
    cwd,
    jsonOutput: isJson,
  });

  if (isJson) {
    DiagnosticStreamer.streamJson(result.envelope, process.stdout);
  } else if (!result.passed) {
    console.error(result.rawOutput);
    // If failures occurred, also output structured diagnostic summary
    if (result.envelope.diagnostics.length > 0) {
      console.error('\n📋 Agent Diagnostic Envelope:');
      DiagnosticStreamer.streamJson(result.envelope, process.stderr);
    }
  } else {
    console.log(result.rawOutput || `✅ Gate ${stage} passed successfully.`);
  }

  return result.exitCode;
}

function handleStream(args: string[]): number {
  const toolName = getArgValue(args, '--tool') || 'gate';
  const stage = (getArgValue(args, '--stage') || 'PreCommit') as any;

  let rawInput = '';
  try {
    rawInput = fs.readFileSync(0, 'utf-8');
  } catch {
    // stdin empty
  }

  const envelope = formatDiagnostics(rawInput, {
    toolName,
    stage,
  });

  DiagnosticStreamer.streamJson(envelope, process.stdout);
  return envelope.summary.total_errors > 0 ? 1 : 0;
}

function handleLock(args: string[]): number {
  const cwd = args.find(a => !a.startsWith('-')) || process.cwd();
  const res = lockGovernance(cwd);
  console.log(`Locked ${res.lockedFiles.length} governance files: ${res.lockedFiles.join(', ')}`);
  if (res.failedFiles.length > 0) {
    console.warn(`Failed to lock: ${res.failedFiles.join(', ')}`);
  }
  return 0;
}

function handleUnlock(args: string[]): number {
  const cwd = args.find(a => !a.startsWith('-')) || process.cwd();
  const res = unlockGovernance(cwd);
  console.log(`Unlocked ${res.lockedFiles.length} governance files: ${res.lockedFiles.join(', ')}`);
  if (res.failedFiles.length > 0) {
    console.warn(`Failed to unlock: ${res.failedFiles.join(', ')}`);
  }
  return 0;
}

function handleStatus(args: string[]): number {
  const cwd = args.find(a => !a.startsWith('-')) || process.cwd();
  const status = getGovernanceStatus(cwd);
  console.log('\n🛡️  Governance Lock Status:');
  for (const [file, info] of Object.entries(status)) {
    console.log(`  ${info.exists ? (info.isLocked ? '🔒 [LOCKED]' : '🔓 [UNLOCKED]') : '❌ [NOT FOUND]'} ${file}`);
  }
  console.log('');
  return 0;
}

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

function printHelp(): void {
  console.log(`
@heretek-ai/agent-proof - Mechanical Hard-Gate for AI Coding Agents

USAGE:
  npx @heretek-ai/agent-proof [options]
  npx create-agent-proof [options]
  npx create-agent-gate [options]
  agent-proof <command> [options]
  agent-gate <command> [options]

COMMANDS:
  init [dir]                Initialize mechanical gates in target repository (default)
  detect [dir]              Inspect and report multi-stack indicators
  run <stage> [file]        Execute gate for stage (pre-commit, pre-push, post-edit)
  format-diagnostics        Parse stdin tool output and stream LSP JSON diagnostics
  lock [dir]                Set immutable read-only permissions on governance configs
  unlock [dir]              Restore write permissions on governance configs
  status [dir]              Check mechanical gate and lock health

OPTIONS:
  --force, -f               Overwrite existing configuration files
  --no-lock                 Do not set read-only permissions on governance files
  --json, --lsp             Output structured LSP JSON diagnostic envelopes
  --help, -h                Show help information
  --version, -v             Show version number
`);
}

// Auto-run if executed directly
if (process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('cli.ts'))) {
  runCli().then(code => process.exit(code));
}
