import type { StackDetectionResult } from '../../types/index.js';

export interface ClaudeHookRule {
  matcher?: string;
  command: string;
}

export interface ClaudeHooksStructure {
  hooks: {
    PostFileEdit?: ClaudeHookRule[];
    PreCommit?: ClaudeHookRule[];
    [key: string]: ClaudeHookRule[] | undefined;
  };
}

export function generateClaudeHooksConfig(detection: StackDetectionResult): string {
  const postFileEditRules: ClaudeHookRule[] = [];

  if (detection.jsTs.detected) {
    postFileEditRules.push({
      matcher: '*.{js,ts,jsx,tsx}',
      command: 'npx @biomejs/biome check --write ${filePath}',
    });
  }

  if (detection.python.detected) {
    postFileEditRules.push({
      matcher: '*.py',
      command: 'ruff check --fix ${filePath}',
    });
  }

  // Always enable skill checking for agent instructions if agent harness is detected or by default
  postFileEditRules.push({
    matcher: '.claude/skills/*.md',
    command: 'skillcheck check ${filePath}',
  });

  postFileEditRules.push({
    matcher: 'SKILL.md',
    command: 'skillcheck check ${filePath}',
  });

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
