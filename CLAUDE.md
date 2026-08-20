# CLAUDE.md — Claude Code Guidelines for Agent-Proof

This guide provides instructions and reference material for **Claude Code** sessions working on `@heretek-ai/agent-proof`.

---

## 🚀 Quick Reference Commands

```bash
# Build the project (tsup bundles to dist/)
npm run build

# Run unit and integration tests (Vitest, 16 suites, 86 tests)
npm test

# Run strict TypeScript type checks
npm run typecheck

# Run real-world sandbox verification script
npm run test:real-repo

# Run polyglot GitHub matrix verification across 5 real-world repositories
npm run test:matrix

# Run oneshot 5-issue real-world Drop verification
npm run test:e2e-5-issues

# Run full automated E2E test against Heretek-AI/drop
npm run test:e2e-drop

# Test CLI locally
node bin/agent-proof.js --version
node bin/agent-proof.js init
node bin/agent-proof.js detect
node bin/agent-proof.js freeze
node bin/agent-proof.js unfreeze
node bin/agent-proof.js attest
node bin/agent-proof.js run pre-commit --sarif
node bin/agent-proof.js status
```

---

## 🏗️ Architecture & Component Overview

Agent-Proof is structured into modular components:

1. **Stack Detector (`src/detector/stackDetector.ts`)**:
   - Inspects target repository indicators (JS/TS, Python, Go, Rust, C/C++, C#, Java, Ruby, Elixir, GitHub Workflows, Docker, Terraform, Kubernetes, Claude Agent Harness, Tach, AST-Grep).
2. **Config Generator (`src/generator/configGenerator.ts`)**:
   - Generates `lefthook.yml`, `.claude/hooks.json`, `biome.json`, `ruff.toml`, and `.aislop/config.yml`.
3. **ByteFence Pre-Write Broker & Spec Freezer (`src/broker/byteFence.ts`)**:
   - Mediates atomic file writes, validates preimage SHA-256 digests, and freezes test directories against Builder modifications (`SPEC_TEST_FROZEN`).
4. **LSPSanitizer (`src/sanitizer/lspSanitizer.ts`)**:
   - Scrubs shell command injections (`curl | sh`, `npx`, `sudo`) from external logs and MCP outputs (Agentjacking defense).
5. **Diagnostic & SARIF Streamer (`src/formatter/`)**:
   - Converts raw stderr/stdout from 11 tools into standard LSP envelopes or SARIF v2.1.0 logs with exact replacement fix regions.
6. **Provenance Engine (`src/attestation/provenance.ts`)**:
   - Signs in-toto attestation receipts using ephemeral Ed25519 keypairs.
7. **Loop Breaker (`src/runner/loopBreaker.ts`)**:
   - Tripwires a hard halt after $\ge 3$ consecutive identical failure iterations.
8. **Hook Installer & Lock-in (`src/installer/`)**:
   - Sets up `.git/hooks/pre-commit` and locks governance files to read-only (`chmod 0444`).

---

## ⚡ Agent Lifecycle Hooks & Interception

When Claude Code operates in a repository initialized with Agent-Proof:

1. **`PostFileEdit` Lifecycle Event**:
   - Fires automatically whenever Claude modifies a file.
   - For `*.{js,ts,jsx,tsx}`, runs `npx @biomejs/biome check --write ${filePath}`.
   - For `*.py`, runs `ruff check --fix ${filePath}`.
   - For `Dockerfile`, runs `hadolint ${filePath}`.
   - For GitHub Workflows, runs `zizmor ${filePath}`.
   - For skills, runs `skillcheck check ${filePath}`.
   - Executes in **`< 50ms`** for immediate AST feedback.

2. **Pre-Commit Hard Gate**:
   - Intercepts `git commit` and runs parallel compiled linters via Lefthook in **`< 2.0s`**.
   - If any violation occurs, a non-zero exit code blocks the commit and provides an LSP diagnostic envelope or SARIF log.

3. **Strict Suppression Hygiene**:
   - Blind suppression directives (`// @ts-ignore`, `// biome-ignore`, `# noqa`) trigger **Severity 1** failures.
   - Parse `repair_tokens` to apply deterministic fixes rather than guessing.

---

## 🛡️ Coding Rules for Claude Code Sessions

1. **Zero Runtime Dependencies**: Keep package dependencies at 0 for published runtime distribution.
2. **Deterministic Output**: Configuration codegen must produce idempotent, formatted outputs.
3. **Strict Error Handling**: Always handle errors explicitly and bubble causes up via `new Error(msg, { cause: err })`.
