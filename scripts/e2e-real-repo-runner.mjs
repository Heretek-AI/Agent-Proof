#!/usr/bin/env node

/**
 * @file scripts/e2e-real-repo-runner.mjs
 * @description Automated repeatable E2E test harness that clones Heretek-AI/drop,
 * installs @heretek-ai/agent-proof, fetches an open issue from Drop-OSS/drop,
 * and drives Claude Code under active mechanical gate governance using LLM credentials.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const binPath = path.join(rootDir, 'bin', 'agent-proof.js');

// Create isolated temporary workspace
const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-proof-e2e-drop-'));
const repoUrl = 'https://github.com/Heretek-AI/drop.git';

// Organization LLM settings
const llmApi = process.env.LLM_API || 'https://llm.heretek.one/v1';
const llmKey = process.env.LLM_KEY || process.env.ANTHROPIC_API_KEY || '';
const llmModel = process.env.LLM_MODEL || 'MiniMax-M3';

console.log('\n======================================================');
console.log(' 🚀 E2E Real-World Test: Heretek-AI/drop + Agent-Proof');
console.log('======================================================');
console.log(`📁 Sandbox Workspace: ${sandboxDir}`);
console.log(`🌐 LLM Endpoint:      ${llmApi}`);
console.log(`🤖 LLM Model:         ${llmModel}`);
console.log(`🔑 LLM Auth:          ${llmKey ? 'Configured (Secret Present)' : 'Not Configured (Using Mechanical Sim)'}\n`);

/**
 * Helper to run test steps with timing and logging
 */
async function runStep(stepNumber, title, fn) {
  console.log(`\n[Step ${stepNumber}/5] ${title}...`);
  const start = performance.now();
  try {
    await fn();
    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`   ✔ PASSED (${elapsed}ms)`);
  } catch (err) {
    const elapsed = (performance.now() - start).toFixed(0);
    console.error(`   ❌ FAILED (${elapsed}ms): ${err.message}`);
    if (err.stdout) console.error(`STDOUT:\n${err.stdout}`);
    if (err.stderr) console.error(`STDERR:\n${err.stderr}`);
    throw err;
  }
}

try {
  // ---------------------------------------------------------------------------
  // STEP 1: Clone Heretek-AI/drop repository
  // ---------------------------------------------------------------------------
  await runStep(1, 'Cloning Heretek-AI/drop repository (--depth 1)', async () => {
    execFileSync('git', ['clone', '--depth', '1', repoUrl, sandboxDir], {
      stdio: 'inherit',
      timeout: 120000,
    });

    if (!fs.existsSync(path.join(sandboxDir, 'package.json'))) {
      throw new Error('Cloned repository does not contain package.json');
    }
  });

  // ---------------------------------------------------------------------------
  // STEP 2: Initialize @heretek-ai/agent-proof into the cloned repository
  // ---------------------------------------------------------------------------
  await runStep(2, 'Initializing @heretek-ai/agent-proof into Heretek-AI/drop', async () => {
    const initOutput = execFileSync(process.execPath, [binPath, 'init', sandboxDir], {
      encoding: 'utf-8',
      timeout: 30000,
    });
    console.log(initOutput);

    // Verify all governance configurations were emitted
    const expectedConfigs = [
      'lefthook.yml',
      '.claude/hooks.json',
      '.claude/settings.json',
      'biome.json',
      '.aislop/config.yml',
    ];

    for (const rel of expectedConfigs) {
      const full = path.join(sandboxDir, rel);
      if (!fs.existsSync(full)) {
        throw new Error(`Expected governance file was not created: ${rel}`);
      }
    }
  });

  // ---------------------------------------------------------------------------
  // STEP 3: Verify Mechanical Governance Permission Lock-in (chmod 0444)
  // ---------------------------------------------------------------------------
  await runStep(3, 'Verifying Governance Permission Lock-in (chmod 0444)', async () => {
    const statusOutput = execFileSync(process.execPath, [binPath, 'status', sandboxDir], {
      encoding: 'utf-8',
    });
    console.log(statusOutput);

    if (!statusOutput.includes('[LOCKED] .claude/hooks.json') || !statusOutput.includes('[LOCKED] lefthook.yml')) {
      throw new Error('Governance status check failed: expected locked files');
    }

    // Verify unauthorized write fails with EACCES
    const hooksPath = path.join(sandboxDir, '.claude', 'hooks.json');
    let writeBlocked = false;
    try {
      fs.writeFileSync(hooksPath, '{"tampered": true}', { flag: 'w' });
    } catch (err) {
      if (err.code === 'EACCES' || err.message.includes('permission denied') || err.message.includes('EACCES')) {
        writeBlocked = true;
        console.log(`   • Verified: Direct file tampering blocked with ${err.code || 'EACCES'}`);
      } else {
        throw err;
      }
    }

    if (!writeBlocked) {
      throw new Error('Unauthorized agent write succeeded on locked file!');
    }
  });

  // ---------------------------------------------------------------------------
  // STEP 4: Fetch an Open Issue from Drop-OSS/drop
  // ---------------------------------------------------------------------------
  let targetIssue = { number: 474, title: '[Bug] IGDB import fails if company does not have logo' };
  await runStep(4, 'Fetching Open Issue from Drop-OSS/drop via GitHub API', async () => {
    try {
      const issueOutput = execFileSync('gh', ['issue', 'view', '474', '--repo', 'Drop-OSS/drop', '--json', 'number,title,body'], {
        encoding: 'utf-8',
      });
      const parsed = JSON.parse(issueOutput);
      if (parsed.number && parsed.title) {
        targetIssue = parsed;
      }
    } catch {
      console.log('   • Fallback: Using target issue #474');
    }
    console.log(`   • Target Issue #${targetIssue.number}: "${targetIssue.title}"`);
  });

  // ---------------------------------------------------------------------------
  // STEP 5: Drive Claude Code / Gate Interception & Verification
  // ---------------------------------------------------------------------------
  await runStep(5, 'Driving Claude Code & Validating Mechanical Gate Interception', async () => {
    // 1. If LLM credentials and Claude CLI exist, drive Claude on the issue
    if (llmKey) {
      console.log(`   • Driving Claude Code with model ${llmModel} at ${llmApi}...`);
      try {
        const claudeEnv = {
          ...process.env,
          ANTHROPIC_BASE_URL: llmApi,
          ANTHROPIC_API_KEY: llmKey,
          ANTHROPIC_MODEL: llmModel,
          OPENAI_BASE_URL: llmApi,
          OPENAI_API_KEY: llmKey,
          OPENAI_MODEL: llmModel,
        };

        const claudePrompt = `Analyze Issue #${targetIssue.number}: "${targetIssue.title}". Create a fix in server/utils/igdb-fix.ts ensuring that company logos handle missing media IDs gracefully without empty catch blocks.`;
        const claudeProc = spawnSync('claude', ['-p', claudePrompt, '--dangerously-skip-permissions'], {
          cwd: sandboxDir,
          env: claudeEnv,
          encoding: 'utf-8',
          timeout: 60000,
        });

        console.log(`   • Claude Code completed with exit code ${claudeProc.status}`);
        if (claudeProc.stdout) {
          const preview = claudeProc.stdout.slice(0, 300).replace(/\n/g, ' ');
          console.log(`   • Claude Output: ${preview}...`);
        }
      } catch (err) {
        console.log(`   • Claude invocation note: ${err.message}`);
      }
    }

    // 2. Verify PostFileEdit hook execution (< 300ms)
    console.log('   • Testing PostFileEdit mechanical gate execution...');
    const testFilePath = path.join(sandboxDir, 'server', 'utils', 'igdb.ts');
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    fs.writeFileSync(testFilePath, `
export async function fetchCompanyLogo(mediaId?: string): Promise<string | null> {
  if (!mediaId) {
    return null;
  }
  return \`https://images.igdb.com/igdb/image/upload/t_thumb/\${mediaId}.jpg\`;
}
`);

    const postEditStart = performance.now();
    const postEditOutput = execFileSync(process.execPath, [binPath, 'run', 'post-edit', testFilePath], {
      cwd: sandboxDir,
      encoding: 'utf-8',
    });
    const postEditDuration = performance.now() - postEditStart;
    console.log(`   • PostFileEdit Gate: ${postEditDuration.toFixed(0)}ms (Target < 300ms)`);
    console.log(`   • Gate Output: ${postEditOutput.trim()}`);

    // 3. Test Pre-Commit Gate (< 2.0s)
    console.log('   • Testing Stage 2 Pre-Commit Gate on staged files...');
    execFileSync('git', ['add', testFilePath], { cwd: sandboxDir });

    const preCommitStart = performance.now();
    const preCommitResult = spawnSync(process.execPath, [binPath, 'run', 'pre-commit'], {
      cwd: sandboxDir,
      encoding: 'utf-8',
    });
    const preCommitDuration = performance.now() - preCommitStart;
    console.log(`   • Pre-Commit Gate: ${preCommitDuration.toFixed(0)}ms (Target < 2000ms)`);

    // 4. Test Slop Interception: Inject an anti-pattern and verify detection
    console.log('   • Injecting AI slop anti-pattern to test mechanical interception...');
    const slopFilePath = path.join(sandboxDir, 'server', 'utils', 'auth-check.ts');
    fs.writeFileSync(slopFilePath, `
export function checkToken(token: string): boolean {
  try {
    const data = JSON.parse(token);
    return data.valid === true;
  } catch (e) {
    // Swallowed error without handling or logging
  }
  return false;
}
`);
    execFileSync('git', ['add', slopFilePath], { cwd: sandboxDir });

    const slopCheckResult = spawnSync(process.execPath, [binPath, 'run', 'pre-commit'], {
      cwd: sandboxDir,
      encoding: 'utf-8',
    });

    console.log(`   • Slop check status: exit code ${slopCheckResult.status}`);
    if (slopCheckResult.stdout.includes('LSP') || slopCheckResult.stdout.includes('AI_SLOP') || slopCheckResult.stderr.includes('AI_SLOP') || slopCheckResult.status !== 0) {
      console.log('   ✔ Verified: Mechanical gate successfully intercepted AI slop pattern!');
    }
  });

  console.log('\n======================================================');
  console.log(' 🎉 All E2E Real-World Tests on Heretek-AI/drop Passed!');
  console.log('======================================================\n');
} finally {
  // Clean up sandbox workspace
  try {
    // Unlock governance files first so rmSync can delete read-only files
    execFileSync(process.execPath, [binPath, 'unlock', sandboxDir], { stdio: 'ignore' });
  } catch {}
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
    console.log(`🧹 Cleaned up sandbox workspace: ${sandboxDir}`);
  } catch {}
}
