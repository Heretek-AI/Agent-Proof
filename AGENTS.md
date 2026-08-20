# AGENTS.md — Multi-Agent Development & Mechanical Governance Protocol

Welcome to **Agent-Proof** (`@heretek-ai/agent-proof`). This document establishes the multi-agent operational standards, mechanical hard-gate execution rules, and architecture guidelines for autonomous AI coding agents operating within this repository.

---

## 🎯 Primary Directives for AI Agents

1. **Deterministic Mechanical Governance Over Soft Prompts**:
   - Never attempt to bypass, disable, or modify mechanical hard gates (`lefthook.yml`, `.claude/hooks.json`, `biome.json`, `ruff.toml`, `.aislop/config.yml`).
   - Governance files are intentionally locked with read-only permissions (`chmod 0444`). Do not attempt to overwrite or change their permissions unless explicitly instructed by a human administrator.
   - Never bypass git hooks with `git commit --no-verify`. All commits must pass mechanical pre-commit validation in `< 2.0s`.

2. **Zero-Tolerance for AI Slop**:
   - **No Empty Catch Blocks / Swallowed Errors**: Always handle exceptions explicitly, log with context, rethrow with cause (`new Error(msg, { cause: err })`), or return explicit typed failure results.
   - **Strict Type Safety**: Avoid `as any` or unchecked type assertions. Use TypeScript type guards, interfaces, or validated schemas (e.g. Zod).
   - **No Hallucinated Imports**: Only import from installed packages declared in `package.json` / `pyproject.toml` or verified relative paths within the project.
   - **Clean ASTs & Formatting**: Ensure code adheres to Biome / Ruff formatting standards without lint violations or dead code.

3. **Autonomous Self-Correction Protocol**:
   - When a mechanical gate fails, parse the emitted **LSP Diagnostic Envelope** (`https://json.schemastore.org/lsif.json`).
   - Extract the `repair_tokens` provided in `diagnostics[].repair_instruction` to apply deterministic fixes immediately rather than guessing or engaging in trial-and-error edits.

---

## 🏗️ 3-Tier Mechanical Gate Architecture

| Stage | Trigger Event | Latency Target | Scope | Canonical Engines |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1: Pre-Tool / Edit** | `PostFileEdit` agent hook | `< 300ms` | Single modified file AST | Biome (`--write`), Ruff (`--fix`), SkillCheck |
| **Stage 2: Hard Git Gate** | `git commit` (Pre-Commit) | `< 2.0s` | Staged blobs (`--staged`) | Lefthook parallel: Biome, Ruff, AISlop, TruffleHog, Typos, Actionlint |
| **Stage 3: CI & Graph Audit** | `git push` / PR Pipeline | Unconstrained | Full codebase graph | Fallow (dead code / arch drift), Sherif (monorepo), OWASP Noir (API surface) |

---

## 📂 Repository Architecture & Key Directories

```
Agent-Proof/
├── bin/                        # Zero-dependency platform binary launchers
│   ├── agent-proof.js          # Primary CLI launcher with optionalDependencies resolution
│   └── agent-gate.js           # Compatibility alias launcher
├── src/                        # TypeScript source code
│   ├── detector/               # Multi-stack auto-detection engine
│   ├── generator/              # Multi-tier configuration generator & templates
│   ├── formatter/              # ANSI-stripper & LSP diagnostic streaming engine
│   ├── installer/              # Git hook installer & POSIX permission lock-in
│   ├── runner/                 # Mechanical gate stage execution runner
│   ├── types/                  # TypeScript interfaces and schema types
│   ├── cli.ts                  # Command-line interface dispatcher
│   └── index.ts                # Package public API exports
├── tests/                      # Vitest unit and integration test suites
│   ├── detector.test.ts        # Polyglot stack detection tests
│   ├── generator.test.ts       # Config codegen tests
│   ├── formatter.test.ts       # Diagnostic streamer and parser tests
│   ├── launcher.test.ts        # Binary resolution tests
│   ├── lockin.test.ts          # Git hook & permission locking tests
│   └── e2e.test.ts             # End-to-end repository initialization test
├── scripts/                    # Development & verification scripts
│   └── verify-real-repo.mjs    # Real-world sandbox lifecycle validation script
├── .github/workflows/          # GitHub Actions CI/CD
│   ├── ci.yml                  # Continuous integration test runner
│   └── publish.yml             # Trusted publishing (OIDC) to npm
├── package.json                # Package definition, scripts, optionalDependencies matrix
├── tsconfig.json               # Strict NodeNext TypeScript configuration
└── tsup.config.ts              # Bundle configuration for dual CJS/ESM distribution
```

---

## 🛠️ Common CLI & Development Commands

```bash
# Build TypeScript bundles into dist/
npm run build

# Run Vitest test suite
npm test

# Run TypeScript typechecks
npm run typecheck

# Run real-world sandbox lifecycle validation
npm run test:real-repo

# Test CLI commands locally
node bin/agent-proof.js --help
node bin/agent-proof.js detect
node bin/agent-proof.js init [directory]
node bin/agent-proof.js run pre-commit
node bin/agent-proof.js status
```

---

## 🔒 Security & Supply Chain Standards

- **NPM Package**: `@heretek-ai/agent-proof` published to `https://registry.npmjs.org/@heretek-ai/agent-proof`.
- **Publishing Method**: OpenID Connect (OIDC) **Trusted Publishing** via `.github/workflows/publish.yml` with `id-token: write` and npm provenance.
- **Dependencies**: Keep runtime dependencies at zero. All utilities are compiled into `dist/` or distributed via platform-specific binary packages under `optionalDependencies`.
