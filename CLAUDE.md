# CLAUDE.md — Claude Code Guidelines for Agent-Proof

This guide provides instructions and reference material for **Claude Code** sessions working on `@heretek-ai/agent-proof`.

---

## 🚀 Quick Reference Commands

```bash
# Build the project (tsup bundles to dist/)
npm run build

# Run unit and integration tests (Vitest)
npm test

# Run strict TypeScript type checks
npm run typecheck

# Run real-world sandbox verification script
npm run test:real-repo

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
   - Converts raw stderr/stdout from tools (`aislop`, `biome`, `ruff`, `skillcheck`, `trufflehog`, `typos`, `actionlint`, `zizmor`, `hadolint`, `tfsec`, `kubescore`, `astgrep`) into an LSP-compliant JSON diagnostic envelope with `repair_tokens`.
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
   - For `.github/workflows/*.{yml,yaml}`, runs `zizmor ${filePath}`.
   - For `Dockerfile*` / `Containerfile*`, runs `hadolint ${filePath}`.
   - For `.claude/skills/*.md` or `SKILL.md`, runs `skillcheck check ${filePath}`.
   - Runs in `< 50ms` on single modified ASTs.

2. **`PreCommit` Lifecycle Event**:
   - Fires when git commit is initiated.
   - Runs `npx lefthook run pre-commit` executing parallel staged checks in `< 2.0s`.

3. **Interpreting Hook Diagnostics**:
   - If a hook fails, inspect the JSON output envelope:
     ```json
     {
       "status": "GATE_FAILED",
       "diagnostics": [
         {
           "source": "aislop",
           "rule_id": "AI_SLOP_SWALLOWED_ERROR",
           "file_path": "src/auth.ts",
           "repair_instruction": {
             "action": "REWRITE_BLOCK",
             "repair_tokens": ["throw new Error(...)"]
           }
         }
       ]
     }
     ```
   - Immediately apply the suggested `repair_tokens` to resolve the violation.

---

## 🚫 Prohibited Actions for Claude Code

- **Do NOT** bypass git hooks using `--no-verify`.
- **Do NOT** attempt to edit or delete `.claude/settings.json`, `.claude/hooks.json`, or `lefthook.yml`. These files are marked read-only (`chmod 0444`) to enforce governance boundaries.
- **Do NOT** insert blind suppression comments (`// @ts-ignore`, `// biome-ignore`, `# noqa`) to bypass type safety or lint rules.
- **Do NOT** introduce empty catch blocks, `as any` casts, or unverified imports.
