/**
 * Core type definitions for @agent-gate/cli
 */

export interface StackDetectionResult {
  rootPath: string;
  jsTs: {
    detected: boolean;
    files: string[];
    hasTypeScript: boolean;
    hasBiome: boolean;
    isMonorepo: boolean;
    packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno';
  };
  python: {
    detected: boolean;
    files: string[];
    hasPyproject: boolean;
    hasRuffConfig: boolean;
  };
  go: {
    detected: boolean;
    files: string[];
  };
  rust: {
    detected: boolean;
    files: string[];
    isWorkspace: boolean;
  };
  infra: {
    detected: boolean;
    hasWorkflows: boolean;
    workflowFiles: string[];
    hasDocker: boolean;
    dockerFiles: string[];
  };
  agentHarness: {
    detected: boolean;
    hasClaude: boolean;
    hasCursor: boolean;
    hasSkillFiles: boolean;
    hasAgentsMd: boolean;
    files: string[];
  };
  summary: {
    primaryStacks: string[];
    totalIndicators: number;
  };
}

export type GateStage = 'PostFileEdit' | 'PreCommit' | 'PrePush' | 'CI';

export type DiagnosticSeverity = 'ERROR' | 'WARNING' | 'INFO' | 'HINT';

export interface DiagnosticRange {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface RepairInstruction {
  action: 'REWRITE_BLOCK' | 'REPLACE_TOKEN' | 'INSERT_IMPORT' | 'DELETE_LINE' | 'EXECUTE_COMMAND' | 'MANUAL_FIX';
  description: string;
  repair_tokens: string[];
  suggested_command?: string;
}

export interface DiagnosticItem {
  source: string;
  rule_id: string;
  severity: DiagnosticSeverity;
  file_path: string;
  range?: DiagnosticRange;
  code_snippet?: string;
  error_message: string;
  repair_instruction?: RepairInstruction;
}

export interface DiagnosticEnvelope {
  $schema: string;
  version: string;
  status: 'GATE_PASSED' | 'GATE_FAILED';
  summary: {
    total_errors: number;
    total_warnings: number;
    gate_stage: GateStage;
  };
  diagnostics: DiagnosticItem[];
  metadata?: {
    execution_time_ms?: number;
    tool_outputs?: Record<string, { exitCode: number; stderr: string; stdout: string }>;
  };
}

export interface GeneratedConfig {
  path: string;
  content: string;
  description: string;
  isImmutable?: boolean;
}

export interface GenerationResult {
  configs: GeneratedConfig[];
  writtenFiles: string[];
  skippedFiles: string[];
}

export interface LockResult {
  lockedFiles: string[];
  failedFiles: string[];
  mode: 'locked' | 'unlocked';
}

export interface HookInstallResult {
  lefthookInstalled: boolean;
  gitHooksPath: string;
  installedHooks: string[];
  message: string;
}
