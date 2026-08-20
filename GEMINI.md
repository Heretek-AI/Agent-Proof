# GEMINI.md — Google Gemini & Antigravity Assistant Guide

This document defines workflows, tool execution guidelines, and architectural standards for **Gemini / Antigravity** sessions working on the `@heretek-ai/agent-proof` codebase.

---

## 🛠️ Project Ecosystem & Stack

- **Package**: `@heretek-ai/agent-proof`
- **Repository**: `https://github.com/Heretek-AI/Agent-Proof`
- **Registry**: `https://registry.npmjs.org/@heretek-ai/agent-proof`
- **Runtime**: Node.js `>= 18.0.0`
- **Build System**: `tsup` (ESBuild-backed dual CJS/ESM packager)
- **Test Framework**: `vitest`
- **Compiler**: TypeScript 5.7+ with strict NodeNext module resolution

---

## 📋 Core Development Workflows

### 1. Build and Typecheck
```bash
# Build CJS, ESM, and .d.ts declarations into dist/
npm run build

# Run strict TypeScript compiler verification without emitting
npm run typecheck
```

### 2. Testing & Verification
```bash
# Run unit & integration test suites
npm test

# Run real-world sandbox lifecycle test
npm run test:real-repo

# Run automated real-world E2E test on Heretek-AI/drop
npm run test:e2e-drop
```

### 3. Publishing & CI/CD
- GitHub Actions workflow [`.github/workflows/publish.yml`](file:///home/john/Projects/Agent-Proof/.github/workflows/publish.yml) uses **Trusted Publishing (OIDC)** with `id-token: write` and npm provenance.
- Publishing is triggered by creating a GitHub Release, pushing a version tag (`v*.*.*`), or manual `workflow_dispatch`.
- Version resolution queries the NPM registry and automatically increments the patch version to prevent `EPUBLISHCONFLICT`.

---

## 🧠 Codebase Knowledge & Key Modules

| Module | Location | Purpose |
| :--- | :--- | :--- |
| **Types** | [`src/types/index.ts`](file:///home/john/Projects/Agent-Proof/src/types/index.ts) | Canonical interfaces, LSP schemas, diagnostic envelopes |
| **Detector** | [`src/detector/stackDetector.ts`](file:///home/john/Projects/Agent-Proof/src/detector/stackDetector.ts) | Multi-stack inspection across polyglot repositories (JS/TS, Py, Go, Rust, C/C++, C#, Java, Ruby, Elixir, Docker, K8s, Terraform, Tach, ast-grep) |
| **Generator** | [`src/generator/configGenerator.ts`](file:///home/john/Projects/Agent-Proof/src/generator/configGenerator.ts) | Deterministic config templates (`lefthook.yml`, `.claude/hooks.json`, `biome.json`, `ruff.toml`, `.aislop/config.yml`) |
| **Formatter** | [`src/formatter/diagnosticStream.ts`](file:///home/john/Projects/Agent-Proof/src/formatter/diagnosticStream.ts) | ANSI stripper, tool output parsers, LSP envelope builder |
| **Parsers** | [`src/formatter/parsers/`](file:///home/john/Projects/Agent-Proof/src/formatter/parsers/) | Specialized parsers for `aislop`, `biome`, `ruff`, `skillcheck`, `trufflehog`, `typos`, `actionlint`, `zizmor`, `hadolint`, `iac`, `astgrep` |
| **Installer** | [`src/installer/`](file:///home/john/Projects/Agent-Proof/src/installer/) | Git hook installation and read-only permission lock-in (`chmod 0444`) |
| **Runner** | [`src/runner/gateRunner.ts`](file:///home/john/Projects/Agent-Proof/src/runner/gateRunner.ts) | Gate stage runner for `post-edit`, `pre-commit`, `pre-push` |
| **CLI** | [`src/cli.ts`](file:///home/john/Projects/Agent-Proof/src/cli.ts) | Command dispatcher (`init`, `detect`, `run`, `lock`, `unlock`, `status`) |
| **Launcher** | [`bin/agent-proof.js`](file:///home/john/Projects/Agent-Proof/bin/agent-proof.js) | Native binary resolution with JS fallback |
| **E2E Runner** | [`scripts/e2e-real-repo-runner.mjs`](file:///home/john/Projects/Agent-Proof/scripts/e2e-real-repo-runner.mjs) | Real-world drop repo lifecycle runner with LLM secrets |

---

## 🛡️ Coding & Architectural Standards

1. **Zero Runtime Dependencies**: The published CLI bundle maintains zero runtime dependencies; native acceleration is handled via `optionalDependencies`.
2. **Zero-Bloat Compiled Engines**: Prefer compiled native binaries (`ast-grep`, `biome`, `ruff`, `tach`, `hadolint`, `zizmor`, `tfsec`) over heavy interpreted linters to guarantee sub-50ms latency.
3. **Strict Suppression Hygiene**: Block unapproved suppression comments (`@ts-ignore`, `# noqa`, `biome-ignore`) across all AST checks.
4. **Deterministic Output**: Always ensure configuration generators output formatted, deterministic strings.
5. **Comprehensive Error Handling**: All CLI commands catch errors, format through DiagnosticStreamer, and exit cleanly with appropriate exit codes.
