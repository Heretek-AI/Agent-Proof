# AGENTS.md — Multi-Agent Development & Mechanical Governance Protocol

Welcome to **Agent-Proof** (`@heretek-ai/agent-proof`). This document establishes the multi-agent operational standards, mechanical hard-gate execution rules, and architecture guidelines for autonomous AI coding agents operating within this repository.

---

## 🎯 Primary Directives for AI Agents

1. **Deterministic Mechanical Governance Over Soft Prompts**:
   - Never attempt to bypass, disable, or modify mechanical hard gates (`lefthook.yml`, `.claude/hooks.json`, `biome.json`, `ruff.toml`, `.aislop/config.yml`).
   - Governance files are intentionally locked with read-only permissions (`chmod 0444`). Do not attempt to overwrite or change their permissions unless explicitly instructed by a human administrator.
   - Never bypass git hooks with `git commit --no-verify`. All commits must pass mechanical pre-commit validation in `< 2.0s`.

2. **Proof-Loop Role Separation & Specification Freezing**:
   - When acting in the `Builder` role, all test suites (`tests/**`, `__tests__/**`), specifications (`spec.md`), and acceptance criteria are frozen.
   - Modifying test assertions to force failing code to pass is strictly blocked by `ByteFence` with `SPEC_TEST_FROZEN`.

3. **Zero-Tolerance for AI Slop & Unsafe Casting**:
   - **No Empty Catch Blocks / Swallowed Errors**: Always handle exceptions explicitly, log with context, rethrow with cause (`new Error(msg, { cause: err })`), or return explicit typed failure results.
   - **Strict Type Safety**: Avoid `as any` or unchecked type assertions. Use TypeScript type guards, interfaces, or validated schemas (e.g. Zod).
   - **No Hallucinated Imports**: Only import from installed packages declared in `package.json` / `pyproject.toml` or verified relative paths within the project.
   - **Clean ASTs & Formatting**: Ensure code adheres to Biome / Ruff formatting standards without lint violations or dead code.

4. **Strict Suppression Hygiene Protocol**:
   - Never insert blind suppression comments (`// @ts-ignore`, `// @ts-nocheck`, `# noqa`, `// biome-ignore`, `// eslint-disable`) to bypass mechanical gates.
   - Newly introduced suppression comments without documented human rationale will trigger blocking **Severity 1** failures (`AI_SLOP_UNAUTHORIZED_SUPPRESSION`).

5. **Autonomous Self-Correction Protocol**:
   - When a mechanical gate fails, parse the emitted **LSP Diagnostic Envelope** (`https://json.schemastore.org/lsif.json`) or **SARIF v2.1.0 Log** (`https://json.schemastore.org/sarif-2.1.0.json`).
   - Extract the `repair_tokens` or SARIF `replacements[]` provided in `diagnostics[].repair_instruction` to apply deterministic fixes immediately rather than guessing or engaging in trial-and-error edits.
   - Respect the `LoopBreaker`: If the same defect repeats $\ge 3$ consecutive times, halt execution to prevent context exhaustion and token burning.

---

## 🏗️ 3-Tier Mechanical Gate Architecture

| Stage | Trigger Event | Latency Target | Scope | Canonical Compiled Engines |
| :--- | :--- | :--- | :--- | :--- |
| **Stage 1: Pre-Tool / Edit** | `PostFileEdit` agent hook | `< 50ms` | Single modified file AST | Biome (`--write`), Ruff (`--fix`), Hadolint, Zizmor, SkillCheck, ast-grep, LSPSanitizer |
| **Stage 2: Hard Git Gate** | `git commit` (Pre-Commit) | `< 2.0s` | Staged blobs (`--staged`) | Lefthook parallel: Biome, Ruff, Tach, AISlop, TruffleHog, Typos, Actionlint, Zizmor, Hadolint, Tfsec, Kube-Score |
| **Stage 3: CI & Graph Audit** | `git push` / PR Pipeline | Unconstrained | Full codebase graph | Fallow (dead code / circular deps), Sherif (monorepo), OWASP Noir (API surface), Cargo Deny, Provenance Attestations |

---

## 📂 Repository Architecture & Key Directories

```
Agent-Proof/
├── bin/                        # Zero-dependency platform binary launchers
│   ├── agent-proof.js          # Primary CLI launcher with fallback resolution
│   └── agent-gate.js           # Compatibility alias launcher
├── src/                        # TypeScript source code
│   ├── detector/               # Multi-stack auto-detection engine (JS/TS, Python, Go, Rust, C/C++, C#, Java, Ruby, Elixir, Docker, Terraform, K8s)
│   ├── generator/              # Multi-tier configuration generator & templates (Lefthook, Biome, Ruff, Claude Hooks, AISlop)
│   ├── formatter/              # ANSI-stripper, SARIF v2.1.0 & LSP diagnostic streaming engine (LSIF schema compliant)
│   │   └── parsers/            # 11 Specialized tool parsers (aislop, biome, ruff, skillcheck, trufflehog, typos, actionlint, zizmor, hadolint, iac, astgrep)
│   ├── sanitizer/              # Agentjacking defense & diagnostic output sanitization
│   ├── broker/                 # ByteFence transactional pre-write broker & specification freezer
│   ├── attestation/            # In-toto cryptographic provenance & Ed25519 signing
│   ├── installer/              # Git hook installer & POSIX permission lock-in (chmod 0444)
│   ├── runner/                 # Mechanical gate stage execution runner & LoopBreaker
│   ├── types/                  # TypeScript interfaces and schema types
│   ├── cli.ts                  # Command-line interface dispatcher
│   └── index.ts                # Package public API exports
├── tests/                      # Vitest unit and integration test suites (16 suites, 86 tests)
│   ├── sanitizer.test.ts       # Agentjacking defense & shell command scrubbing tests
│   ├── bytefence.test.ts       # Preimage verification & specification freezing tests
│   ├── sarif.test.ts           # SARIF v2.1.0 output formatting & fix region tests
│   ├── provenance.test.ts      # In-toto Ed25519 signing & workspace tree hashing tests
│   ├── loopbreaker.test.ts     # Failure loop breaker & tripwire tests
│   ├── ai-agent-scenarios.test.ts # 8 Complex AI Agent failure simulation scenarios & self-correction
│   ├── parsers.test.ts         # Exhaustive unit test suite for all 11 specialized LSP parsers
│   ├── runner.test.ts          # Gate stage runner execution & timeout handling
│   ├── cli.test.ts             # Command-line interface integration tests
│   ├── benchmark.test.ts       # Sub-50ms performance and latency SLA assertions
│   ├── detector.test.ts        # Polyglot stack detection tests
│   ├── generator.test.ts       # Config codegen tests
│   ├── formatter.test.ts       # Diagnostic streamer and parser tests
│   ├── launcher.test.ts        # Zero-dependency binary resolution tests
│   ├── lockin.test.ts          # Git hook & permission locking tests
│   └── e2e.test.ts             # End-to-end repository initialization test
├── scripts/                    # Development & verification scripts
│   ├── test-polyglot-matrix.mjs# Real-world 5-repository GitHub integration matrix test
│   ├── e2e-5-issues-runner.mjs # Oneshot 5-issue real-world Drop test harness
│   ├── verify-real-repo.mjs    # Real-world sandbox lifecycle validation script
│   └── e2e-real-repo-runner.mjs# Automated E2E test harness driving Heretek-AI/drop & Claude Code
├── .github/workflows/          # GitHub Actions CI/CD
│   ├── ci.yml                  # Continuous integration test runner
│   ├── e2e-drop.yml            # Real-world Drop repository E2E validation with LLM secrets
│   └── publish.yml             # OpenID Connect (OIDC) Trusted Publishing to npm with dynamic auto-incrementation
├── package.json                # Package definition, scripts, zero-runtime dependency configuration
├── tsconfig.json               # Strict NodeNext TypeScript configuration
└── tsup.config.ts              # Bundle configuration for dual CJS/ESM distribution
```

---

## 🛠️ Common CLI & Development Commands

```bash
# Build TypeScript bundles into dist/
npm run build

# Run Vitest test suites (16 suites, 86 tests)
npm test

# Run TypeScript typechecks
npm run typecheck

# Run real-world sandbox lifecycle validation
npm run test:real-repo

# Run polyglot GitHub matrix verification across 5 real repositories
npm run test:matrix

# Run oneshot 5-issue real-world Drop verification
npm run test:e2e-5-issues

# Run full automated E2E test against Heretek-AI/drop
npm run test:e2e-drop

# Test CLI commands locally
node bin/agent-proof.js --help
node bin/agent-proof.js detect
node bin/agent-proof.js init [directory]
node bin/agent-proof.js freeze [directory]
node bin/agent-proof.js unfreeze [directory]
node bin/agent-proof.js attest [directory]
node bin/agent-proof.js run pre-commit --sarif
node bin/agent-proof.js status
```

---

## 🤖 Specialized Autonomous Sub-Agent Roles

When deploying autonomous multi-agent swarms or delegating tasks, adhere to the following specialized sub-agent role specifications:

### 1. Architecture Auditor (`architecture-auditor`)
- **Mission**: Enforce modular separation of concerns, layer isolation, and prevent cyclic dependency drift.
- **Rules**:
  - Domain / core logic must never import transport, UI, or external adapter layers.
  - Intercept tight coupling between independent modules before code is staged using `Tach`, `fallow`, and `ast-grep`.
  - Verify package boundaries in monorepo structures using `Sherif`.

### 2. Security & Secret Reviewer (`security-reviewer`)
- **Mission**: Block credential leaks, injection vectors, and unauthorized privilege escalation.
- **Rules**:
  - Prohibit hardcoded high-entropy API tokens, private keys, or credentials (`TruffleHog`).
  - Audit GitHub Actions workflows for expression injection and unpinned actions (`zizmor`, `actionlint`).
  - Validate Dockerfiles and Kubernetes manifests (`hadolint`, `kube-score`, `tfsec`).
  - Enforce `LSPSanitizer` on all external observability logs to prevent Agentjacking.

### 3. Performance & Memory Optimizer (`performance-optimizer`)
- **Mission**: Prevent algorithmic bottlenecks, memory leaks, and blocking operations.
- **Rules**:
  - Eliminate synchronous blocking I/O on hot execution paths.
  - Ensure unhandled Promise rejections and dangling event listeners are remediated.
  - Utilize zero-bloat compiled binaries to maintain sub-50ms editor feedback loops.

### 4. Test & Verification Engineer (`test-engineer`)
- **Mission**: Author comprehensive, deterministic unit and integration tests under specification freeze.
- **Rules**:
  - Every new feature or parser must include unit tests with 100% path coverage.
  - Never author non-deterministic tests that depend on unpinned network calls or timers.
  - Validate failure branches and verify that repair tokens produce clean, passing builds.

---

## 🔒 Security & Supply Chain Standards

- **NPM Package**: `@heretek-ai/agent-proof` published to `https://registry.npmjs.org/@heretek-ai/agent-proof`.
- **Publishing Method**: OpenID Connect (OIDC) **Trusted Publishing** via `.github/workflows/publish.yml` with `id-token: write` and npm provenance.
- **Dependencies**: Zero runtime dependencies. Compiled into `dist/` with native acceleration via standalone compiled engines.
