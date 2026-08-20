/**
 * @file src/types/index.ts
 * @description Core TypeScript type definitions, LSP schemas, and diagnostic data structures
 * for the @heretek-ai/agent-proof mechanical hard-gate CLI.
 *
 * Defines the contract between stack detectors, configuration generators,
 * tool failure parsers, and autonomous AI self-correction diagnostic streams.
 */

/**
 * Result of the multi-stack repository inspection engine.
 * Contains boolean indicators, detected signature files, and metadata
 * across all supported language ecosystems, infrastructure, and agent harnesses.
 */
export interface StackDetectionResult {
  /** Absolute root path of the inspected repository */
  rootPath: string;

  /** JavaScript & TypeScript ecosystem detection details */
  jsTs: {
    /** True if any JS/TS signature files (package.json, tsconfig.json, etc.) were found */
    detected: boolean;
    /** List of relative file paths that triggered JS/TS detection */
    files: string[];
    /** True if TypeScript configuration or dependencies are present */
    hasTypeScript: boolean;
    /** True if Biome linter/formatter configuration is already present */
    hasBiome: boolean;
    /** True if monorepo workspace configuration (pnpm, yarn, lerna, turbo) was detected */
    isMonorepo: boolean;
    /** Detected package manager (npm, pnpm, yarn, bun, or deno) */
    packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno';
  };

  /** Python ecosystem detection details */
  python: {
    /** True if any Python signature files (pyproject.toml, requirements.txt, etc.) were found */
    detected: boolean;
    /** List of relative file paths that triggered Python detection */
    files: string[];
    /** True if pyproject.toml is present */
    hasPyproject: boolean;
    /** True if Ruff configuration is defined in ruff.toml or pyproject.toml */
    hasRuffConfig: boolean;
  };

  /** Go ecosystem detection details */
  go: {
    /** True if Go signature files (go.mod, go.sum, etc.) were found */
    detected: boolean;
    /** List of relative file paths that triggered Go detection */
    files: string[];
  };

  /** Rust ecosystem detection details */
  rust: {
    /** True if Cargo signature files (Cargo.toml, Cargo.lock) were found */
    detected: boolean;
    /** List of relative file paths that triggered Rust detection */
    files: string[];
    /** True if Cargo.toml defines a multi-crate workspace */
    isWorkspace: boolean;
  };

  /** Infrastructure, CI workflows, and containerization detection */
  infra: {
    /** True if CI workflow files or Docker containers were detected */
    detected: boolean;
    /** True if GitHub Actions workflow YAML files are present */
    hasWorkflows: boolean;
    /** List of relative paths to GitHub Actions workflow files */
    workflowFiles: string[];
    /** True if Dockerfile or docker-compose files are present */
    hasDocker: boolean;
    /** List of relative paths to Docker / container definition files */
    dockerFiles: string[];
  };

  /** AI agent harness, skill definitions, and configuration files */
  agentHarness: {
    /** True if any AI agent harness files (.claude, .cursor, SKILL.md) were found */
    detected: boolean;
    /** True if Claude Code harness (.claude/ or CLAUDE.md) is present */
    hasClaude: boolean;
    /** True if Cursor IDE harness (.cursor/ or .cursorrules) is present */
    hasCursor: boolean;
    /** True if agent skill markdown files (.claude/skills/*.md or SKILL.md) are present */
    hasSkillFiles: boolean;
    /** True if AGENTS.md manifest is present */
    hasAgentsMd: boolean;
    /** List of relative paths to agent harness files */
    files: string[];
  };

  /** High-level summary of detected stacks */
  summary: {
    /** Human-readable names of primary detected language/ecosystem stacks */
    primaryStacks: string[];
    /** Total count of all matching indicator files across all stacks */
    totalIndicators: number;
  };
}

/**
 * Supported execution stages in the 3-tier mechanical gate lifecycle
 */
export type GateStage = 'PostFileEdit' | 'PreCommit' | 'PrePush' | 'CI';

/**
 * Severity level for diagnostic items conforming to LSP standards
 */
export type DiagnosticSeverity = 'ERROR' | 'WARNING' | 'INFO' | 'HINT';

/**
 * 1-indexed source code coordinate range where a violation occurred
 */
export interface DiagnosticRange {
  /** Start line and column of the violation */
  start: {
    line: number;
    column: number;
  };
  /** End line and column of the violation */
  end: {
    line: number;
    column: number;
  };
}

/**
 * Structured self-correction repair instruction for AI agents.
 * Contains actionable code replacement tokens that an LLM can apply directly.
 */
export interface RepairInstruction {
  /** Action category guiding the agent's edit strategy */
  action: 'REWRITE_BLOCK' | 'REPLACE_TOKEN' | 'INSERT_IMPORT' | 'DELETE_LINE' | 'EXECUTE_COMMAND' | 'MANUAL_FIX';
  /** Human and LLM readable explanation of how to fix the violation */
  description: string;
  /** Concrete code replacement strings or repair tokens for autonomous correction */
  repair_tokens: string[];
  /** Optional shell command that can automatically resolve the issue (e.g. biome check --write) */
  suggested_command?: string;
}

/**
 * Individual diagnostic item representing a single lint, security, or slop violation
 */
export interface DiagnosticItem {
  /** Name of the tool or engine that produced the finding (e.g. 'aislop', 'biome', 'ruff') */
  source: string;
  /** Machine-readable rule identifier (e.g. 'AI_SLOP_SWALLOWED_ERROR', 'F401', 'noExplicitAny') */
  rule_id: string;
  /** Severity level (ERROR, WARNING, INFO, HINT) */
  severity: DiagnosticSeverity;
  /** Relative or absolute path to the file containing the violation */
  file_path: string;
  /** Exact line/column range in the source file */
  range?: DiagnosticRange;
  /** Relevant code snippet around the violation */
  code_snippet?: string;
  /** Detailed error message describing the violation */
  error_message: string;
  /** Actionable repair guidance and tokens for autonomous self-correction */
  repair_instruction?: RepairInstruction;
}

/**
 * Top-level LSP-compliant diagnostic envelope emitted by the Diagnostic Streamer.
 * Conforms to JSON Schema: https://json.schemastore.org/lsif.json
 */
export interface DiagnosticEnvelope {
  /** JSON Schema URI for validation */
  $schema: string;
  /** Schema specification version */
  version: string;
  /** Overall gate status: GATE_PASSED if 0 errors, GATE_FAILED otherwise */
  status: 'GATE_PASSED' | 'GATE_FAILED';
  /** Aggregated error and warning counts for this stage */
  summary: {
    total_errors: number;
    total_warnings: number;
    gate_stage: GateStage;
  };
  /** List of all diagnostic items detected across all executed tools */
  diagnostics: DiagnosticItem[];
  /** Execution metadata including timing and per-tool exit codes */
  metadata?: {
    execution_time_ms?: number;
    tool_outputs?: Record<string, { exitCode: number; stderr: string; stdout: string }>;
  };
}

/**
 * Representation of a generated configuration file to be written to disk
 */
export interface GeneratedConfig {
  /** Relative destination path (e.g. 'lefthook.yml', '.claude/hooks.json') */
  path: string;
  /** Complete file content string */
  content: string;
  /** Descriptive summary of the configuration file's role */
  description: string;
  /** If true, the file will be marked read-only (chmod 0444) to prevent agent tampering */
  isImmutable?: boolean;
}

/**
 * Result of emitting configuration files to disk
 */
export interface GenerationResult {
  /** All configuration templates computed for the detected stacks */
  configs: GeneratedConfig[];
  /** Relative paths of files successfully created or updated on disk */
  writtenFiles: string[];
  /** Relative paths of files skipped because they already exist and force was false */
  skippedFiles: string[];
}

/**
 * Result of locking or unlocking governance file permissions
 */
export interface LockResult {
  /** Files that were successfully updated with new permissions */
  lockedFiles: string[];
  /** Files that could not be updated due to errors */
  failedFiles: string[];
  /** Current mode applied: 'locked' (0444) or 'unlocked' (0644) */
  mode: 'locked' | 'unlocked';
}

/**
 * Result of installing mechanical git hooks
 */
export interface HookInstallResult {
  /** True if lefthook CLI installed hooks natively */
  lefthookInstalled: boolean;
  /** Path to the .git/hooks directory */
  gitHooksPath: string;
  /** List of hook names installed (e.g. ['pre-commit', 'pre-push']) */
  installedHooks: string[];
  /** Status description message */
  message: string;
}
