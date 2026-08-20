#!/usr/bin/env node

/**
 * @file scripts/test-polyglot-matrix.mjs
 * @description Real-World Polyglot GitHub Matrix Integration Test:
 * Clones and validates Agent-Proof across 5 major software ecosystems:
 * 1. Fullstack TS / Vue3: Heretek-AI/drop
 * 2. Python Ecosystem: encode/httpx
 * 3. Go Microservices: charmbracelet/bubbletea
 * 4. Rust Native: sharkdp/bat
 * 5. Infra / Containers: GoogleContainerTools/distroless
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const binPath = path.join(rootDir, 'bin', 'agent-proof.js');

const matrix = [
  {
    name: 'Heretek-AI/drop',
    stack: 'TypeScript / Vue3 / SQLite',
    url: 'https://github.com/Heretek-AI/drop.git',
    expectedConfigs: ['lefthook.yml', '.claude/hooks.json', 'biome.json', '.aislop/config.yml'],
    expectedStackKeywords: ['JavaScript/TypeScript', 'Workflows/Infra'],
  },
  {
    name: 'encode/httpx',
    stack: 'Python / Pytest / Ruff',
    url: 'https://github.com/encode/httpx.git',
    expectedConfigs: ['lefthook.yml', '.claude/hooks.json', 'ruff.toml', '.aislop/config.yml'],
    expectedStackKeywords: ['Python'],
  },
  {
    name: 'charmbracelet/bubbletea',
    stack: 'Go / Microservices',
    url: 'https://github.com/charmbracelet/bubbletea.git',
    expectedConfigs: ['lefthook.yml', '.claude/hooks.json', '.aislop/config.yml'],
    expectedStackKeywords: ['Go'],
  },
  {
    name: 'sharkdp/bat',
    stack: 'Rust / Cargo',
    url: 'https://github.com/sharkdp/bat.git',
    expectedConfigs: ['lefthook.yml', '.claude/hooks.json', '.aislop/config.yml'],
    expectedStackKeywords: ['Rust'],
  },
  {
    name: 'GoogleContainerTools/distroless',
    stack: 'Infra / Containers / Bazel',
    url: 'https://github.com/GoogleContainerTools/distroless.git',
    expectedConfigs: ['lefthook.yml', '.claude/hooks.json', '.aislop/config.yml'],
    expectedStackKeywords: ['Workflows/Infra'],
  },
];

console.log('\n==================================================================');
console.log(' 🌐 Real-World Polyglot GitHub Matrix Integration Test');
console.log('==================================================================\n');

const results = [];

for (let i = 0; i < matrix.length; i++) {
  const repo = matrix[i];
  const repoTempDir = fs.mkdtempSync(path.join(os.tmpdir(), `agent-proof-matrix-${i}-`));
  const startTime = performance.now();

  console.log(`------------------------------------------------------------------`);
  console.log(` [${i + 1}/${matrix.length}] Testing Stack: ${repo.stack} (${repo.name})`);
  console.log(`------------------------------------------------------------------`);

  try {
    // 1. Shallow clone target repository
    console.log(`   • Cloning ${repo.url} (--depth 1)...`);
    execFileSync('git', ['clone', '--depth', '1', repo.url, repoTempDir], {
      stdio: 'ignore',
      timeout: 90000,
    });

    // 2. Run agent-proof detect
    const detectStart = performance.now();
    const detectOutput = execFileSync(process.execPath, [binPath, 'detect', repoTempDir], {
      encoding: 'utf-8',
    });
    const detectDuration = (performance.now() - detectStart).toFixed(0);
    console.log(`   • Stack Detection (${detectDuration}ms):`);

    for (const kw of repo.expectedStackKeywords) {
      if (!detectOutput.includes(kw)) {
        throw new Error(`Expected detected stack keyword '${kw}' not found in output`);
      }
      console.log(`     ✔ Confirmed Stack: ${kw}`);
    }

    // 3. Run agent-proof init
    const initStart = performance.now();
    execFileSync(process.execPath, [binPath, 'init', repoTempDir], {
      stdio: 'ignore',
      timeout: 30000,
    });
    const initDuration = (performance.now() - initStart).toFixed(0);
    console.log(`   • Config Codegen & Lock-in (${initDuration}ms)`);

    // 4. Verify expected configurations
    for (const conf of repo.expectedConfigs) {
      const fullPath = path.join(repoTempDir, conf);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Expected governance config '${conf}' was not created!`);
      }
      const stat = fs.statSync(fullPath);
      const mode = (stat.mode & 0o777).toString(8);
      if (mode !== '444') {
        throw new Error(`Config '${conf}' mode is ${mode}, expected 444 (read-only lock)!`);
      }
    }
    console.log(`     ✔ All ${repo.expectedConfigs.length} governance configurations emitted with mode 444`);

    // 5. Test status check
    const statusOutput = execFileSync(process.execPath, [binPath, 'status', repoTempDir], {
      encoding: 'utf-8',
    });
    if (!statusOutput.includes('[LOCKED]')) {
      throw new Error('Status output does not report [LOCKED] configs');
    }
    console.log(`     ✔ Status validation passed`);

    const totalElapsed = (performance.now() - startTime).toFixed(0);
    results.push({
      repo: repo.name,
      stack: repo.stack,
      detectMs: `${detectDuration}ms`,
      initMs: `${initDuration}ms`,
      totalMs: `${totalElapsed}ms`,
      status: 'PASSED',
    });
  } catch (err) {
    console.error(`   ❌ FAILED: ${err.message}`);
    results.push({
      repo: repo.name,
      stack: repo.stack,
      detectMs: 'N/A',
      initMs: 'N/A',
      totalMs: 'N/A',
      status: 'FAILED',
    });
  } finally {
    try {
      execFileSync(process.execPath, [binPath, 'unlock', repoTempDir], { stdio: 'ignore' });
    } catch {}
    try {
      fs.rmSync(repoTempDir, { recursive: true, force: true });
    } catch {}
  }
}

console.log('\n==================================================================');
console.log(' 📊 Polyglot GitHub Real-World Matrix Summary');
console.log('==================================================================');
console.table(results);

const allPassed = results.every(r => r.status === 'PASSED');
if (!allPassed) {
  console.error('\n❌ One or more repositories failed polyglot matrix verification.');
  process.exit(1);
} else {
  console.log('\n🎉 All 5 Polyglot GitHub Repositories Successfully Verified!\n');
}
