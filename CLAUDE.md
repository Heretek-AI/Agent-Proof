# CLAUDE.md — Claude Code Guidelines for Agent-Proof

This guide provides instructions and reference material for **Claude Code** sessions working on `@heretek-ai/agent-proof`.

---

## 🚀 Quick Reference Commands

```bash
# Build the project (tsup bundles to dist/)
npm run build

# Run unit and integration tests (Vitest, 11 suites, 73 tests)
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
node bin/agent-proof.js status
```

---

## 🏗️ Architecture & Component Overview

Agent-Proof is structured into modular components:

1. **Stack Detector (`src/detector/stackDetector.ts`)**:
   - Inspects target repository indicators (JS/TS, Python, Go, Rust, C/C++, C#, Java, Ruby, Elixir, GitHub Workflows, Docker, Terraform, Kubernetes, Claude Agent Harness, Tach, AST-Grep).
2. **Config Generator (`src/generator/configGenerator.ts`)**:
   - Generates `lefthook.yml`, `.claude/hooks.json`, `biome.json`, `ruff.toml`, and `.aislop/config.yml`.
3. **Diagnostic Streamer (`src/formatter/diagnosticStream.ts`)**:
   - Converts raw stderr/stdout from 11 tools (`aislop`, `biome`, `ruff`, `skillcheck`, `trufflehog`, `typos`, `actionlint`, `zizmor`, `hadolint`, `tfsec`, `kube-score`, `astgrep`) into an LSP-compliant JSON diagnostic envelope with `repair_tokens`.
4. **Hook Installer & Lock-in (`src/installer/`)**:
   - Sets up `.git/hooks/pre-commit` and locks governance files to read-only (`chmod 0444`).
5. **Gate Runner (`src/runner/gateRunner.ts`)**:
   - Executes gate stages (`post-edit`, `pre-commit`, `pre-push`).
6. **Binary Launchers (`bin/agent-proof.js` & `bin/agent-gate.js`)**:
   - Zero-dependency node wrappers that delegate execution directly to native architecture binaries or fall back to `dist/cli.js`.

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
   - If any violation occurs, a non-zero exit code blocks the commit and provides an LSP diagnostic envelope.

3. **Strict Suppression Hygiene**:
   - Blind suppression directives (`// @ts-ignore`, `// biome-ignore`, `# noqa`) trigger **Severity 1** failures.
   - Parse `repair_tokens` to apply deterministic fixes rather than guessing.

---

## 🛡️ Coding Rules for Claude Code Sessions

1. **Zero Runtime Dependencies**: Keep package dependencies at 0 for published runtime distribution.
2. **Deterministic Output**: Configuration codegen must produce idempotent, formatted outputs.
3. **Strict Error Handling**: Always handle errors explicitly and bubble causes up via `new Error(msg, { cause: err })`.
