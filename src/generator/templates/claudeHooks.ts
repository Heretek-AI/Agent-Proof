/**
 * @file src/generator/templates/claudeHooks.ts
 * @description Generates the .claude/hooks.json configuration for Stage 1 agent tool interception.
 *
 * Automatically intercepts agent file edits (PostFileEdit) to format and lint modified ASTs
 * in < 300ms, and routes pre-commit git commands through the mechanical Lefthook runner.
 */

import type { StackDetectionResult } from '../../types/index.js';

/**
 * Individual hook rule configuration for Claude Code lifecycle events
 */
export interface ClaudeHookRule {
  /** Glob matcher pattern (e.g. '*.{js,ts}', '*.py', '.claude/skills/*.md') */
  matcher?: string;
  /** Shell command executed when the matcher matches the modified file */
  command: string;
}

/**
 * Top-level structure of .claude/hooks.json
 */
export interface ClaudeHooksStructure {
  hooks: {
    /** Intercepts file modification tools (FileEdit, FileWrite) */
    PostFileEdit?: ClaudeHookRule[];
    /** Intercepts git commit operations */
    PreCommit?: ClaudeHookRule[];
    [key: string]: ClaudeHookRule[] | undefined;
  };
}

/**
 * Generate .claude/hooks.json for Stage 1 agent tool interception.
 *
 * @param detection Stack detection result containing language and harness indicators
 * @returns Formatted JSON string for .claude/hooks.json
 */
export function generateClaudeHooksConfig(detection: StackDetectionResult): string {
  const postFileEditRules: ClaudeHookRule[] = [];

  // JS/TS: Instant single-file format & lint on edit
  if (detection.jsTs.detected) {
    postFileEditRules.push({
      matcher: '*.{js,ts,jsx,tsx}',
      command: 'npx @biomejs/biome check --write ${filePath}',
    });
  }

  // Python: Instant single-file format & fix on edit
  if (detection.python.detected) {
    postFileEditRules.push({
      matcher: '*.py',
      command: 'ruff check --fix ${filePath}',
    });
  }

  // Skill files: Validate agent skills against schema and OWASP agentic boundaries
  postFileEditRules.push({
    matcher: '.claude/skills/*.md',
    command: 'skillcheck check ${filePath}',
  });

  postFileEditRules.push({
    matcher: 'SKILL.md',
    command: 'skillcheck check ${filePath}',
  });

  // Assemble the complete Claude hooks object
  const hooksConfig: ClaudeHooksStructure = {
    hooks: {
      PostFileEdit: postFileEditRules,
      PreCommit: [
        {
          command: 'npx lefthook run pre-commit',
        },
      ],
    },
  };

  return JSON.stringify(hooksConfig, null, 2) + '\n';
}

/**
 * Generate .claude/settings.json enforcing locked mechanical gate governance.
 *
 * @returns Formatted JSON string for .claude/settings.json
 */
export function generateClaudeSettingsConfig(): string {
  const settings = {
    governance: {
      locked: true,
      agentGateVersion: '1.0.0',
      enforceMechanicalGates: true,
      lspDiagnosticStreaming: true,
    },
  };
  return JSON.stringify(settings, null, 2) + '\n';
}
