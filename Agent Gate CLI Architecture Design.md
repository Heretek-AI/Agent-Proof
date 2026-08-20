# **Architecture & Tool Selection for an "Agent-Proof" Mechanical Hard-Gate CLI**

## **1\. Executive Mission & Core Objectives**

Autonomous AI coding agents—including Claude Code, OpenCode, Codex, Aider, Devin, and Cursor—have transformed software development velocity. However, their stochastic, probabilistic nature introduces severe systemic risks into production codebases. When agents operate autonomously, they frequently generate "AI Slop": code that compiles and passes basic unit tests but introduces architectural rot, phantom dependencies, unhandled exception patterns, swallowed errors, empty catch blocks, hallucinated imports, and cross-language syntax leakages1.  
Prompt-based guardrails such as CLAUDE.md, .cursorrules, or rules.md fail under context window pressure. As conversation context grows or task complexity increases, LLMs systematically ignore soft markdown instructions4. The fundamental flaw of prompt-based governance is attempting to enforce deterministic software engineering rules using a probabilistic medium. To reliably prevent agent-driven regressions, security vulnerabilities, and code quality degradation, software repositories require mechanical hard gates: OS-level, deterministic binary execution hooks that physically intercept agent tool calls and git operations, blocking non-compliant changes before they reach version control5.  
The primary challenge in establishing mechanical hard gates lies in balancing developer experience (DX) with absolute rigor. Modern repositories often suffer from tool sprawl, relying on dozens of disjointed linters, formatters, static application security testing (SAST) utilities, and supply chain checkers. Many of these legacy tools depend on heavy, slow interpreted runtimes (such as Python or Node.js), causing pre-commit hooks to take 10 to 30 seconds to execute. Developers and AI agents routinely bypass these slow checks using \--no-verify.  
To create an agent-proof repository, mechanical gates must fulfill two core criteria:

> 1. Zero-Config Developer & Agent Experience: Packaging comprehensive static analysis, AST validation, secret scanning, and supply-chain auditing into a single sub-second execution harness distributed via a zero-dependency CLI (such as npx create-agent-gate).  
> 2. Sub-Second Deterministic Execution: Replacing legacy interpreted linter stacks with single-pass, multi-threaded native binaries compiled in Rust, Go, or Crystal, guaranteeing local staged-file pre-commit validation in under 2 seconds1.

## **2\. Tool Categorization & Deduplication Matrix**

To achieve sub-second execution during local git hooks while maintaining exhaustive security and structural checks, legacy tooling must be aggressively deduplicated and modernized. Interpreted tools that run sequentially must be replaced by unified native binaries capable of parallel execution1.

### **Rationalization & Deduplication Analysis**

#### **Secret & Sensitive Data Scanning**

Legacy pre-commit-hooks (such as detect-private-key) rely on basic regex matching executed via Python scripts. Standardizing on TruffleHog OSS (compiled Go) or Gitleaks provides high-throughput, entropy-based analysis and verified secret detection across staged git blobs without runtime dependencies.

#### **SAST & Security Analysis**

Deep static analysis utilities like SonarQube, flawfinder, and dockerfile-security-scan (hadolint) are too slow for local pre-commit hooks. They belong exclusively in pre-push or CI pipelines. For AI-generated security risks, local pre-commit gates deploy aislop and vibecheck1. aislop uses deterministic rules across 10 languages to instantly flag empty catch blocks, swallowed errors, unsafe casts, and hallucinatory patterns without LLM runtime calls1. For API attack surface mapping, OWASP Noir (Crystal) statically extracts routes, parameters, and shadow APIs, exporting structured \--ai-context specifically for agent evaluation during deep auditing stages10. AgentShield operates as an egress HTTP/HTTPS proxy firewall12; it is categorized as a runtime environment sandbox guard rather than a static pre-commit hook analyzer.

#### **Agent Skill & Harness Scoring**

To prevent AI agents from malfunctioning due to malformed instruction files or corrupted skills, instruction artifacts must be audited mechanically5. SkillCheck validates .claude/skills and SKILL.md frontmatter, trigger phrases, token efficiency, and OWASP agentic security rules13. For project-level JS/TS structural health, fallow operates as a high-speed codebase intelligence engine that scans the complete dependency graph to detect unused exports, circular dependencies, complexity hotspots, and architectural boundary drift14. sherif (compiled Rust) provides zero-config monorepo dependency version locking across pnpm, yarn, and npm workspaces7. harness-score performs zero-dependency static filesystem auditing of agent harnesses16.

#### **Dependency & Supply Chain Integrity**

Interpreted auditing tools are replaced with compiled native utilities: cargo-deny for Rust dependency graphs, sherif for JS/TS monorepo lockfile alignment7, and is-my-node-vulnerable or socket CLI for lockfile security verification.

#### **Multi-Language Formatters & Linters**

Meta-linters such as super-linter and megalinter are multi-gigabyte Docker images designed for CI, making them unusable for instant local feedback loops. Legacy JavaScript/TypeScript chains (Prettier \+ ESLint \+ Standard) are replaced by Biome (Rust), which formats and lints files in milliseconds1. Legacy Python chains (pyupgrade \+ autopep8 \+ flake8 \+ isort \+ black) are replaced by Ruff (Rust). ShellCheck is pinned as a static binary. Configuration files are validated using actionlint (Go) for GitHub Workflows and yamlfmt (Go) or Biome for JSON/YAML schemas.

#### **Prose & Typos**

Source code spelling errors and documentation typos are validated instantly using typos (crate-ci/typos in Rust), which checks source code ASTs without flagging variable names, combined with markdownlint-cli2 for prose formatting.

| Category | Input / Legacy Tooling | Canonical Engine | Runtime | Speed / Overhead |
| :---- | :---- | :---- | :---- | :---- |
| **Secret Scanning** | detect-private-key, trufflehog | TruffleHog OSS | Go Native | Sub-second |
| **Fast AI Slop & Security** | vibecheck, aislop, flawfinder | aislop | Rust/Node | Sub-second1 |
| **Deep SAST & Endpoint Maps** | SonarQube, gosec, OWASP Noir | OWASP Noir \+ gosec | Crystal | 2s \- 10s (CI)11 |
| **Agent Skill & Schema Audit** | validate-agent-skills, SkillCheck | SkillCheck | Go Native | Sub-second13 |
| **Codebase Graph & Monorepo** | fallow, sherif, harness-score | Fallow \+ Sherif | Rust/C | Milliseconds7 |
| **JS/TS Linter & Formatter** | ESLint, Prettier, Standard, Biome | Biome | Rust | 10-100x vs ESLint |
| **Python Linter & Formatter** | Pyupgrade, Autopep8, Flake8, Ruff | Ruff | Rust | 100-1000x vs Pep8 |
| **Shell Linter** | bashate, shellcheck-py | ShellCheck | Haskell/C | Sub-second |
| **Workflow & Config Schema** | yamllint, yamlfmt, actionlint | actionlint \+ yamlfmt | Go Native | Sub-second |
| **Codebase Typo Scanning** | proselint, typos | typos (crate-ci) | Rust | Sub-second |
| **Monorepo & Supply Chain** | dependency-review, cargo-deny | Sherif \+ cargo-deny | Rust | Sub-second7 |

## **3\. Key Investigation Dimensions**

### **A. Deduplication & Engine Modernization**

The central pillar of mechanical hard-gate design is the strict separation between Synchronous Local Gates and Asynchronous CI Gates. Running deep SAST scans or full codebase graph traversals on every git commit degrades developer experience, prompting engineers and agents to bypass controls.  
Synchronous Local Gates operate exclusively on staged files using the git diff \--cached \--name-only filter. By targeting a execution budget under two seconds, local pre-commit hooks deploy parallel compiled native binaries such as Biome, Ruff, typos, aislop, and TruffleHog1. Checks are strictly constrained to single-file AST parsing, syntax validation, format enforcing, and staged file entropy scanning1.  
Asynchronous CI / Pre-Push Gates operate on the entire codebase graph without execution time constraints. These pipelines execute deep multi-file static analysis, structural dead code elimination analysis (fallow)15, API route and shadow endpoint extraction (OWASP Noir)10, cross-package dependency version alignment (sherif)7, cargo dependency policies (cargo-deny), deep SAST (SonarQube, gosec), and test coverage regression checks (codecov).

### **B. Agent-Specific Hook Design**

AI coding agents interface with repositories through tool-use loops (such as FileWrite, FileEdit, BashExecute). Prompt-based rules fail because they compete for attention inside the LLM context window. To enforce compliance, agent-specific hooks must be injected directly into the agent harness lifecycle5.  
For Claude Code, hooks are registered in .claude/hooks.json across lifecycle events6:

* PreToolUse: Intercepts tool execution before changes are applied to the filesystem. Validates arguments, schema types, and path boundaries.  
* PostToolUse / PostFileEdit: Fires immediately after an agent modifies a file. Runs instant single-file linting (Biome check \--write, Ruff check \--fix) and streams LSP diagnostics directly back to the agent session6.  
* PreCommit: Synchronous hard gate blocking non-compliant commits6.

Agents are known to modify their own prompt instructions (CLAUDE.md, .claude/skills/, rules.md) to bypass restrictions or remove failing constraints. The mechanical gate CLI enforces immutable protection over agent instruction files:

> 1. **Schema & Frontmatter Validation:** Every edit to .claude/skills/\*.md or SKILL.md triggers SkillCheck via a PostToolUse hook13. SkillCheck verifies YAML frontmatter schemas, trigger phrases, OWASP agentic security boundaries, and blocks prompt injection or tool over-granting attempts13.  
> 2. **Read-Only / Lock Enforcement:** In strict agent modes, the CLI marks .claude/settings.json, .claude/hooks.json, and core instruction files as read-only or injects git index locks preventing agents from staging modifications to governance configurations6.

### **C. Zero-Dependency NPX Distribution Strategy**

To achieve a zero-friction developer experience, npx create-agent-gate must execute instantly on any developer machine or CI container without requiring pre-installed system runtimes (such as Python, Go, Rust, or Ruby).  
Following the distribution architecture of modern high-performance tooling (such as Lefthook, esbuild, turborepo, and pkglab), the CLI uses NPM platform-specific packages declared under optionalDependencies8. The primary package (@agent-gate/cli) contains a thin, zero-dependency Node.js executable wrapper19. The package.json specifies native platform binaries as optional dependencies constrained by os and cpu fields8:

JSON  
{  
  "name": "@agent-gate/cli",  
  "version": "1.0.0",  
  "bin": {  
    "create-agent-gate": "./bin/agent-gate.js"  
  },  
  "optionalDependencies": {  
    "@agent-gate/binary-darwin-arm64": "1.0.0",  
    "@agent-gate/binary-darwin-x64": "1.0.0",  
    "@agent-gate/binary-linux-x64": "1.0.0",  
    "@agent-gate/binary-win32-x64": "1.0.0"  
  }  
}

During npx execution, NPM downloads only the binary matching the host OS and CPU architecture8. The JS wrapper resolves the path to the native compiled binary (containing pre-compiled Lefthook, Biome, Ruff, typos, TruffleHog, aislop, and SkillCheck binaries) and executes it directly via execFileSync1.

## **4\. Deliverable Requirements**

### **A. The Rationalized Stack Specification**

The final architecture consolidates tools into a canonical engine matrix categorized by execution domain.

| Domain | Canonical Engine | Primary Responsibility | Execution Timing |
| :---- | :---- | :---- | :---- |
| **Secret Scanning** | TruffleHog OSS | High-entropy & verified secret detection | Stage 2 (Pre-Commit) |
| **AI Slop Detection** | aislop | 50+ deterministic AI quality rules | Stage 2 (Pre-Commit)1 |
| **Codebase Graph Audit** | Fallow | Unused code, circular deps, arch drift | Stage 3 (Pre-Push/CI)15 |
| **API Attack Surface** | OWASP Noir | Endpoint extraction & shadow API mapping | Stage 3 (Pre-Push/CI)11 |
| **Monorepo Versioning** | Sherif | Monorepo dependency version lock | Stage 3 (Pre-Push/CI)7 |
| **JS/TS Engine** | Biome | Sub-millisecond linting and formatting | Stage 1 & Stage 2 |
| **Python Engine** | Ruff | Sub-millisecond linting and formatting | Stage 1 & Stage 2 |
| **Shell Engine** | ShellCheck | Shell script static analysis | Stage 2 (Pre-Commit) |
| **Workflow & Schemas** | actionlint | GitHub Actions workflow verification | Stage 2 (Pre-Commit) |
| **Typo Verification** | typos | Native AST code spelling check | Stage 2 (Pre-Commit) |
| **Agent Skill Guard** | SkillCheck | Agent skill & SKILL.md schema check | Stage 1 & Stage 213 |
| **Orchestration Engine** | Lefthook | Multi-threaded parallel git hook runner | Stage 2 & Stage 320 |

### **B. Hook Execution Pipeline Design**

| Pipeline Stage | Trigger Event | Runtime Budget | Target Scope | Enforced Engines |
| :---- | :---- | :---- | :---- | :---- |
| **Stage 1: Pre-Tool / Edit** | PostFileEdit / Tool Intercept | \< 300 ms | Single Modified File AST | Biome check \--write, Ruff check \--fix, SkillCheck6 |
| **Stage 2: Hard Git Gate** | git commit (Pre-Commit) | \< 2.0 s | Staged Files (--staged) | Lefthook parallel: Biome, Ruff, TruffleHog, aislop, typos, actionlint1 |
| **Stage 3: Full CI Audit** | git push / PR (CI) | Unconstrained | Full Repository Graph | Fallow audit, OWASP Noir, Sherif, cargo-deny, gosec, SonarQube, Codecov7 |

#### **Stage 1: Pre-Tool / Agent-Action Hooks**

Executed inside the AI agent lifecycle harness (such as Claude Code or Cursor) via .claude/hooks.json6. When an agent executes a file modification tool (FileEdit, FileWrite), the hook runs Biome or Ruff directly on the modified file AST. If the agent modifies .claude/skills/\* or SKILL.md, SkillCheck executes immediately to validate skill frontmatter, security boundaries, and trigger formatting13. Diagnostics are formatted as structured JSON error streams fed back to the agent session before the tool call finishes6.

#### **Stage 2: Pre-Commit Hard Gates**

Executed synchronously by Lefthook when a human or agent invokes git commit8. Lefthook executes parallel, native binary threads across git staged files (--staged). The runner executes biome check \--staged, ruff check \--staged \--fix, aislop scan \--staged \--fail-on 501, trufflehog git file://. \--staged \--only-verified, typos \--staged, and actionlint (if .github/workflows/ files are staged). If any check fails with a non-zero exit code, Lefthook aborts the git commit operation and outputs a structured error summary20.

#### **Stage 3: Pre-Push / CI Agent Hard Gates**

Executed during git push or inside CI pipelines (GitHub Actions, GitLab CI). This stage performs full repository graph analysis: fallow audit evaluates the full graph for dead code, unlisted dependencies, circular imports, and architecture boundary drift15; noir scan . \--ai-context \-f sarif extracts all API endpoints, surfaces shadow routes, and exports security context10; sherif audits monorepo dependency versions across package boundaries7; cargo-deny check audits Rust dependencies; gosec and SonarQube generate SARIF reports for enterprise security dashboards; and codecov enforces minimum code coverage thresholds on PR diffs.

### **C. CLI Architecture Blueprint**

The npx create-agent-gate bootstrapper operates as an automated repository initializer. It scans the repository, auto-detects language stacks, downloads target-specific compiled binaries, generates unified configuration files, and locks in mechanical hooks6.

| Detected Stack | Signature Files | Injected Engines | Generated Configurations |
| :---- | :---- | :---- | :---- |
| **JS / TS Node.js** | package.json, tsconfig.json | Biome, fallow, sherif | biome.json, .claude/hooks.json \[cite: 6, 7, 15\] |
| **Python** | pyproject.toml, requirements.txt | Ruff, aislop | ruff.toml, .aislop/config.yml \[cite: 1\] |
| **Go** | go.mod | gosec, golangci-lint | .golangci.yml |
| **Rust** | Cargo.toml | cargo-deny, clippy | deny.toml |
| **GitHub CI / Infra** | .github/workflows/, Dockerfile | actionlint, hadolint | lefthook.yml \[cite: 20\] |
| **Agent Harness** | .claude/, .cursor/, AGENTS.md | SkillCheck, aislop | .claude/hooks.json, SKILL.md \[cite: 1, 6, 13\] |

#### **Core Configuration Artifacts Emitted by CLI**

##### **lefthook.yml (Git Hook Orchestration)**

YAML  
\# Generated by create-agent-gate  
pre-commit:  
  parallel: true  
  commands:  
    biome-check:  
      glob: "\*.{js,ts,jsx,tsx,json,jsonc}"  
      run: npx biome check \--staged \--no-errors-on-unmatched  
    ruff-check:  
      glob: "\*.py"  
      run: ruff check \--staged \--fix  
    aislop-scan:  
      run: npx aislop scan \--staged \--fail-on 50  
    secret-scan:  
      run: trufflehog git file://. \--staged \--only-verified  
    typo-check:  
      run: typos \--staged  
    actionlint:  
      glob: ".github/workflows/\*.{yml,yaml}"  
      run: actionlint

pre-push:  
  commands:  
    fallow-audit:  
      run: npx fallow audit  
    monorepo-sherif:  
      run: npx setup-sherif

##### **.claude/hooks.json (Agent Harness Interception)**

JSON  
{  
  "hooks": {  
    "PostFileEdit": \[  
      {  
        "matcher": "\*.{js,ts,jsx,tsx}",  
        "command": "npx biome check \--write ${filePath}"  
      },  
      {  
        "matcher": "\*.py",  
        "command": "ruff check \--fix ${filePath}"  
      },  
      {  
        "matcher": ".claude/skills/\*.md",  
        "command": "skillcheck check ${filePath}"  
      }  
    \],  
    "PreCommit": \[  
      {  
        "command": "npx lefthook run pre-commit"  
      }  
    \]  
  }  
}

### **D. Agent Self-Correction & Feedback Loop Protocol**

When a mechanical gate fails during an agent session, dumping raw, unformatted CLI terminal stderr into the LLM context window causes repair failures. LLMs struggle to parse unstructured ANSI terminal color codes, leading to hallucinated fixes or repetitive trial-and-error loops6.  
To enable deterministic self-correction, mechanical gates intercept failure streams and translate errors into a standardized JSON LSP Diagnostic Envelope.

JSON  
{  
  "$schema": "https://json.schemastore.org/lsif.json",  
  "version": "1.0.0",  
  "status": "GATE\_FAILED",  
  "summary": {  
    "total\_errors": 1,  
    "total\_warnings": 0,  
    "gate\_stage": "PreCommit"  
  },  
  "diagnostics": \[  
    {  
      "source": "aislop",  
      "rule\_id": "AI\_SLOP\_SWALLOWED\_ERROR",  
      "severity": "ERROR",  
      "file\_path": "src/controllers/auth.ts",  
      "range": {  
        "start": { "line": 88, "column": 7 },  
        "end": { "line": 92, "column": 8 }  
      },  
      "code\_snippet": "try {\\n  await verifyToken(token);\\n} catch (e) {}",  
      "error\_message": "AI-Slop Pattern Detected: Empty catch block silently suppresses authentication failure.",  
      "repair\_instruction": {  
        "action": "REWRITE\_BLOCK",  
        "description": "Handle the exception explicitly. Either log the error, rethrow a custom AuthError, or return an explicit HTTP 401 Unauthorized response.",  
        "repair\_tokens": \[  
          "import { AuthException } from '../errors';",  
          "throw new AuthException('Token verification failed', { cause: e });"  
        \]  
      }  
    }  
  \]  
}

#### **Contextual Enrichment via OWASP Noir and Fallow**

For complex multi-file errors (such as circular dependencies or exposed shadow APIs), single-line errors are insufficient. The feedback protocol enriches diagnostics using structural context:

* **OWASP Noir \--ai-context Data:** When an endpoint security violation occurs, Noir supplies the agent with the 1-hop callees, security guards, sinks, and validators associated with the route, allowing the agent to resolve authorization gaps without scanning the entire project tree10.  
* **Fallow Graph Intelligence JSON:** When an architectural boundary violation occurs, fallow emits a structural JSON envelope detailing the exact dependency cycle or unlisted export, guiding the agent to remove dead code or fix module boundaries without trial-and-error edits15.

### **E. Actionable Implementation Roadmap**

Enterprise adoption of mechanical hard gates should follow a phased implementation plan to avoid developer friction while securing code quality.

| Phase | Duration | Core Deliverables | Success Metrics |
| :---- | :---- | :---- | :---- |
| **Phase 1: Baseline & Inventory** | Week 1 | Execute npx create-agent-gate \--init. Generate baselines for aislop & vibecheck1. Commit governance configs. | Baseline generated; zero existing code breaks9. |
| **Phase 2: Agent Harness Interception** | Week 2 | Inject .claude/hooks.json & register Stage 1 edit hooks6. Enforce SkillCheck validation on skill changes13. | Sub-300ms post-edit linting active; skill schemas locked6. |
| **Phase 3: Synchronous Hard Gates** | Week 3 | Lock .git/hooks/pre-commit via Lefthook20. Enforce parallel native checks on staged files (Biome, Ruff, aislop, TruffleHog). | Local pre-commit gates complete in \< 2s; zero unverified secrets1. |
| **Phase 4: CI & Graph Governance** | Week 4 | Enable Stage 3 CI gates (fallow audit, OWASP Noir, sherif, cargo-deny)7. Block PR merges failing architectural gates. | Full codebase graph & shadow API mapping enforced in CI11. |

#### **Key Recommendations for Existing Legacy Codebases**

> 1. **Leverage Baseline Files for Immediate Adoption:** When deploying aislop or vibecheck to an established codebase, do not attempt to resolve all historical technical debt immediately9. Generate baseline files (aislop \--update-baseline) to record pre-existing issues9. Mechanical gates will exit with code 0 for legacy findings while enforcing zero tolerance for newly introduced slop or regressions9.  
> 2. **Lock Governance Settings:** Ensure local agent settings files (.claude/settings.json, .claude/hooks.json) are committed to version control and marked as protected paths in repository settings to prevent autonomous agents from tampering with validation hooks6.  
> 3. **Stream Standardized Diagnostics:** Verify that all hook failures output formatted JSON payloads to maximize the agent's ability to auto-correct issues autonomously without human intervention6.

#### **Works cited**

> 1. scanaislop/aislop: Catch and fix the code-quality issues AI coding agents leave behind \- dead code, unsafe casts, swallowed errors, duplication, security risks, and more. 50+ deterministic rules across 10 language targets, with CLI, CI, and GitHub Actions. No LLM at runtime. MIT., [https://github.com/scanaislop/aislop](https://github.com/scanaislop/aislop)  
> 2. rsionnach/sloppylint: Python AI Slop Detector \- Find over-engineering, hallucinations, and dead code in Python codebases \- GitHub, [https://github.com/rsionnach/sloppylint](https://github.com/rsionnach/sloppylint)  
> 3. Show HN: AISlop, a CLI for catching AI generated code smells | Hacker News, [https://news.ycombinator.com/item?id=48322956](https://news.ycombinator.com/item?id=48322956)  
> 4. This Linter Rejects AI Slop From Your Code \- YouTube, [https://www.youtube.com/watch?v=mmrSYvYKD9g](https://www.youtube.com/watch?v=mmrSYvYKD9g)  
> 5. The Complete Guide to Claude Code V3: LSP, CLAUDE.md, MCP, Skills & Hooks — Now With IDE-Level Code Intelligence : r/ClaudeAI \- Reddit, [https://www.reddit.com/r/ClaudeAI/comments/1qe239d/the\_complete\_guide\_to\_claude\_code\_v3\_lsp\_claudemd/](https://www.reddit.com/r/ClaudeAI/comments/1qe239d/the_complete_guide_to_claude_code_v3_lsp_claudemd/)  
> 6. LSP Tools Plugin \- GitHub, [https://github.com/zircote/lsp-tools](https://github.com/zircote/lsp-tools)  
> 7. Setup Sherif · Actions · GitHub Marketplace, [https://github.com/marketplace/actions/setup-sherif](https://github.com/marketplace/actions/setup-sherif)  
> 8. Packaging Rust Applications for the NPM Registry \- Orhun's Blog, [https://blog.orhun.dev/packaging-rust-for-npm/](https://blog.orhun.dev/packaging-rust-for-npm/)  
> 9. vibecheck-ai-slop · Actions · GitHub Marketplace, [https://github.com/marketplace/actions/vibecheck-ai-slop](https://github.com/marketplace/actions/vibecheck-ai-slop)  
> 10. OWASP Noir \- GitHub, [https://github.com/owasp-noir](https://github.com/owasp-noir)  
> 11. GitHub \- owasp-noir/noir: Hunt every Endpoint in your code, expose Shadow APIs, map the Attack Surface., [https://github.com/owasp-noir/noir](https://github.com/owasp-noir/noir)  
> 12. kamuimk/agentshield \- GitHub, [https://github.com/kamuimk/agentshield](https://github.com/kamuimk/agentshield)  
> 13. SkillCheck: Validate Agent Skills for Claude, Cursor, VS Code, [https://getskillcheck.com/](https://getskillcheck.com/)  
> 14. GitHub \- fallow-rs/fallow-skills: Agent skills for fallow, codebase intelligence for TypeScript and JavaScript. Teaches AI agents how to find unused code, duplication, circular deps, complexity hotspots, architecture drift, design-system drift, and (with Fallow Runtime) hot-path and cold-path evidence. Works with Claude Code, Cursor, Codex, Gemini CLI, and 30+ agents., [https://github.com/fallow-rs/fallow-skills](https://github.com/fallow-rs/fallow-skills)  
> 15. Fallow \- Codebase Intelligence · Actions · GitHub Marketplace, [https://github.com/marketplace/actions/fallow-codebase-intelligence](https://github.com/marketplace/actions/fallow-codebase-intelligence)  
> 16. SECURITY.md \- paladini/harness-score \- GitHub, [https://github.com/paladini/harness-score/blob/main/SECURITY.md](https://github.com/paladini/harness-score/blob/main/SECURITY.md)  
> 17. Tools reference \- Claude Code Docs, [https://code.claude.com/docs/en/tools-reference](https://code.claude.com/docs/en/tools-reference)  
> 18. Claude Code settings \- Claude Code Docs, [https://code.claude.com/docs/en/settings](https://code.claude.com/docs/en/settings)  
> 19. clerk/pkglab: Fast local package development CLI with an embedded fast NPM registry. Publish, test, and iterate on workspace packages across consumer repos. \- GitHub, [https://github.com/clerk/pkglab](https://github.com/clerk/pkglab)  
> 20. hyperframes:Write HTML. Render video. Built for agents. \- AtomGit \- GitCode, [https://gitcode.com/xafc029/hyperframes](https://gitcode.com/xafc029/hyperframes)  
> 21. Hunt every endpoint in your code. \- OWASP Noir, [https://owasp-noir.github.io/noir/](https://owasp-noir.github.io/noir/)  
> 22. Agent Skills \- fallow: codebase intelligence for TypeScript and JavaScript, [https://fallow.mintlify.app/integrations/agent-skills](https://fallow.mintlify.app/integrations/agent-skills)