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
# Run unit & integration test suites (16 suites, 86 tests)
npm test

# Run real-world sandbox lifecycle test
npm run test:real-repo

# Run polyglot GitHub matrix verification across 5 real-world repositories
npm run test:matrix

# Run oneshot 5-issue real-world Drop verification
npm run test:e2e-5-issues

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
| **Types** | [`src/types/index.ts`](file:///home/john/Projects/Agent-Proof/src/types/index.ts) | Canonical interfaces, LSP & SARIF schemas, diagnostic envelopes |
| **Detector** | [`src/detector/stackDetector.ts`](file:///home/john/Projects/Agent-Proof/src/detector/stackDetector.ts) | Multi-stack inspection across polyglot repositories |
| **Generator** | [`src/generator/configGenerator.ts`](file:///home/john/Projects/Agent-Proof/src/generator/configGenerator.ts) | Deterministic config templates (`lefthook.yml`, `.claude/hooks.json`, `biome.json`, `ruff.toml`, `.aislop/config.yml`) |
| **ByteFence** | [`src/broker/byteFence.ts`](file:///home/john/Projects/Agent-Proof/src/broker/byteFence.ts) | Pre-write broker, preimage verification, and specification/test freezing |
| **Sanitizer** | [`src/sanitizer/lspSanitizer.ts`](file:///home/john/Projects/Agent-Proof/src/sanitizer/lspSanitizer.ts) | Agentjacking defense & command injection scrubber |
| **Formatter** | [`src/formatter/diagnosticStream.ts`](file:///home/john/Projects/Agent-Proof/src/formatter/diagnosticStream.ts) | ANSI stripper, tool output parsers, LSP envelope builder |
| **SARIF** | [`src/formatter/sarifStream.ts`](file:///home/john/Projects/Agent-Proof/src/formatter/sarifStream.ts) | OASIS SARIF v2.1.0 formatter with exact line/col replacement regions |
| **Attestation** | [`src/attestation/provenance.ts`](file:///home/john/Projects/Agent-Proof/src/attestation/provenance.ts) | In-toto cryptographic provenance & Ed25519 signing engine |
| **LoopBreaker** | [`src/runner/loopBreaker.ts`](file:///home/john/Projects/Agent-Proof/src/runner/loopBreaker.ts) | Failure loop tripwire preventing token and context window exhaustion |
| **Installer** | [`src/installer/`](file:///home/john/Projects/Agent-Proof/src/installer/) | Git hook installation and read-only permission lock-in (`chmod 0444`) |
| **Runner** | [`src/runner/gateRunner.ts`](file:///home/john/Projects/Agent-Proof/src/runner/gateRunner.ts) | Gate stage runner for `post-edit`, `pre-commit`, `pre-push` |
| **CLI** | [`src/cli.ts`](file:///home/john/Projects/Agent-Proof/src/cli.ts) | Command dispatcher (`init`, `detect`, `run`, `freeze`, `unfreeze`, `sanitize`, `attest`, `lock`, `unlock`, `status`) |
| **Launcher** | [`bin/agent-proof.js`](file:///home/john/Projects/Agent-Proof/bin/agent-proof.js) | Zero-dependency binary resolution with JS fallback |

---

## 🛡️ Coding & Architectural Standards

1. **Zero Runtime Dependencies**: The published CLI bundle maintains zero runtime dependencies; execution relies on standalone compiled engines and native Node.js crypto.
2. **Zero-Bloat Compiled Engines**: Prefer compiled native binaries (`ast-grep`, `biome`, `ruff`, `tach`, `hadolint`, `zizmor`, `tfsec`) over heavy interpreted linters to guarantee sub-50ms latency.
3. **Strict Suppression Hygiene**: Block unapproved suppression comments (`@ts-ignore`, `# noqa`, `biome-ignore`) across all AST checks.
4. **Deterministic Output**: Always ensure configuration generators output formatted, deterministic strings.
5. **Comprehensive Error Handling**: All CLI commands catch errors, format through DiagnosticStreamer/SarifStreamer, and exit cleanly with appropriate exit codes.
