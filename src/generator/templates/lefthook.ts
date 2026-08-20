/**
 * @file src/generator/templates/lefthook.ts
 * @description Generates the lefthook.yml multi-threaded parallel git hook runner configuration.
 *
 * Implements:
 * - Stage 2: Synchronous Local Pre-Commit Hard Gates (< 2.0s execution target)
 *   Runs compiled native binaries across staged files (Biome, Ruff, Tach, ast-grep, AISlop, TruffleHog, Typos, Actionlint, Zizmor, Hadolint, Tfsec, Kube-Score)
 * - Stage 3: CI & Codebase Graph Governance
 *   Runs deep analysis (Fallow, Sherif, OWASP Noir, Cargo Deny) during pre-push or CI.
 */

import type { StackDetectionResult } from '../../types/index.js';

/**
 * Generate a complete lefthook.yml configuration tailored to the detected repository stacks.
 *
 * @param detection Stack detection result containing language and workflow indicators
 * @returns Formatted YAML string for lefthook.yml
 */
export function generateLefthookConfig(detection: StackDetectionResult): string {
  const preCommitCommands: string[] = [];
  const prePushCommands: string[] = [];

  // =========================================================================
  // Stage 2: Pre-Commit Hard Gates (< 2.0s execution target on staged files)
  // =========================================================================

  // JS/TS: Fast native linting & formatting via Biome on staged files
  if (detection.jsTs.detected) {
    preCommitCommands.push(`    biome-check:
      glob: "*.{js,ts,jsx,tsx,json,jsonc}"
      run: npx @biomejs/biome check --staged --no-errors-on-unmatched`);
  }

  // Python: Fast native linting & auto-fixing via Ruff on staged files
  if (detection.python.detected) {
    preCommitCommands.push(`    ruff-check:
      glob: "*.py"
      run: ruff check --staged --fix`);

    preCommitCommands.push(`    tach-check:
      glob: "*.py"
      run: if command -v tach >/dev/null 2>&1; then tach check; fi`);
  }

  // Go: Fast static security analysis via gosec
  if (detection.go.detected) {
    preCommitCommands.push(`    gosec-check:
      glob: "*.go"
      run: gosec -quiet ./...`);
  }

  // Rust: Cargo dependency and license policy checking
  if (detection.rust.detected) {
    preCommitCommands.push(`    cargo-deny:
      glob: "Cargo.{toml,lock}"
      run: cargo deny check`);
  }

  // C/C++: clang-format / clang-tidy on staged files
  if (detection.cpp?.detected) {
    preCommitCommands.push(`    cpp-check:
      glob: "*.{c,cpp,h,hpp,cc,cxx}"
      run: clang-format --dry-run --Werror {staged_files}`);
  }

  // C# / .NET: dotnet format check
  if (detection.csharp?.detected) {
    preCommitCommands.push(`    dotnet-format:
      glob: "*.{cs,fs}"
      run: dotnet format --verify-no-changes`);
  }

  // Java: checkstyle / spotbugs check
  if (detection.java?.detected) {
    preCommitCommands.push(`    java-check:
      glob: "*.java"
      run: if command -v checkstyle >/dev/null 2>&1; then checkstyle {staged_files}; fi`);
  }

  // Ruby: rubocop check
  if (detection.ruby?.detected) {
    preCommitCommands.push(`    rubocop-check:
      glob: "*.rb"
      run: if command -v rubocop >/dev/null 2>&1; then rubocop --force-exclusion {staged_files}; fi`);
  }

  // Elixir: mix credo check
  if (detection.elixir?.detected) {
    preCommitCommands.push(`    credo-check:
      glob: "*.{ex,exs}"
      run: if command -v mix >/dev/null 2>&1; then mix credo --strict {staged_files}; fi`);
  }

  // Universal: Fast structural AST search and rewriting via ast-grep
  preCommitCommands.push(`    ast-grep-scan:
      run: if command -v sg >/dev/null 2>&1; then sg scan; elif command -v ast-grep >/dev/null 2>&1; then ast-grep scan; fi`);

  // Universal: Fast deterministic AI slop and swallowed error detection
  preCommitCommands.push(`    aislop-scan:
      run: if command -v aislop >/dev/null 2>&1; then aislop scan --staged; fi`);

  // Universal: High-entropy secret scanning via TruffleHog OSS (verified secrets only)
  preCommitCommands.push(`    secret-scan:
      run: if command -v trufflehog >/dev/null 2>&1; then trufflehog git file://. --staged --only-verified; fi`);

  // Universal: AST-aware source code spell checking via typos
  preCommitCommands.push(`    typo-check:
      run: if command -v typos >/dev/null 2>&1; then typos --staged; fi`);

  // Infra: GitHub Actions workflow syntax & security validation via actionlint & zizmor
  if (detection.infra.hasWorkflows) {
    preCommitCommands.push(`    actionlint:
      glob: ".github/workflows/*.{yml,yaml}"
      run: if command -v actionlint >/dev/null 2>&1; then actionlint; fi`);

    preCommitCommands.push(`    zizmor-audit:
      glob: ".github/workflows/*.{yml,yaml}"
      run: if command -v zizmor >/dev/null 2>&1; then zizmor .github/workflows; fi`);
  }

  // Infra: Docker / Container security validation via hadolint
  if (detection.infra.hasDocker) {
    preCommitCommands.push(`    hadolint-check:
      glob: "{Dockerfile*,Containerfile*,docker-compose*.{yml,yaml}}"
      run: if command -v hadolint >/dev/null 2>&1; then hadolint {staged_files}; fi`);
  }

  // Infra: Terraform / OpenTofu IaC static security analysis via tfsec
  if (detection.infra.hasTerraform) {
    preCommitCommands.push(`    tfsec-check:
      glob: "*.{tf,tfvars}"
      run: if command -v tfsec >/dev/null 2>&1; then tfsec .; fi`);
  }

  // Infra: Kubernetes static security analysis via kube-score
  if (detection.infra.hasKubernetes) {
    preCommitCommands.push(`    kube-score-check:
      glob: "{k8s/**,kubernetes/**,*.k8s.{yml,yaml}}"
      run: if command -v kube-score >/dev/null 2>&1; then kube-score score {staged_files}; fi`);
  }

  // =========================================================================
  // Stage 3: Pre-Push / CI Full Codebase Graph Governance
  // =========================================================================

  // JS/TS: Full graph dead code, unused exports, and circular import audit
  if (detection.jsTs.detected) {
    prePushCommands.push(`    fallow-audit:
      run: npx fallow audit`);
  }

  // Monorepo: Cross-package dependency version alignment via Sherif
  if (detection.jsTs.isMonorepo) {
    prePushCommands.push(`    monorepo-sherif:
      run: npx setup-sherif`);
  }

  // Universal: API attack surface mapping and shadow endpoint extraction via OWASP Noir
  prePushCommands.push(`    noir-scan:
      run: noir scan . --ai-context -f sarif`);

  // Rust: Comprehensive dependency policy verification
  if (detection.rust.detected && !prePushCommands.some(c => c.includes('cargo-deny'))) {
    prePushCommands.push(`    cargo-deny:
      run: cargo deny check`);
  }

  // Assemble the final YAML document with descriptive comments
  const parts = [
    '# Generated by @heretek-ai/agent-proof - Mechanical Hard Gate Orchestration',
    '# Stage 2: Synchronous Local Pre-Commit Hard Gate (< 2.0s budget)',
    'pre-commit:',
    '  parallel: true',
    '  commands:',
    preCommitCommands.join('\n'),
    '',
    '# Stage 3: Full CI & Codebase Graph Governance',
    'pre-push:',
    '  commands:',
    prePushCommands.join('\n'),
    '',
  ];

  return parts.join('\n');
}
