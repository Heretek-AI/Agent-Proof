import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { HookInstallResult } from '../types/index.js';

export interface HookInstallerOptions {
  cwd?: string;
  force?: boolean;
}

export class HookInstaller {
  private readonly rootPath: string;

  constructor(options: HookInstallerOptions = {}) {
    this.rootPath = path.resolve(options.cwd || process.cwd());
  }

  /**
   * Install and lock git hooks for pre-commit and pre-push stages
   */
  public install(): HookInstallResult {
    const gitDir = path.resolve(this.rootPath, '.git');
    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      return {
        lefthookInstalled: false,
        gitHooksPath: '',
        installedHooks: [],
        message: 'No .git repository found. Skipped git hook installation.',
      };
    }

    const hooksDir = path.resolve(gitDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true });
    }

    let lefthookSuccess = false;
    try {
      execSync('npx lefthook install', {
        cwd: this.rootPath,
        stdio: 'pipe',
        timeout: 10000,
      });
      lefthookSuccess = true;
    } catch {
      // If npx lefthook install is not yet available, fallback to manual hook script generation
    }

    const installedHooks: string[] = [];

    // Ensure pre-commit hook exists and is executable
    const preCommitPath = path.resolve(hooksDir, 'pre-commit');
    const preCommitContent = `#!/bin/sh
# Agent-Proof Mechanical Hard-Gate Pre-Commit Hook
if command -v lefthook >/dev/null 2>&1; then
  lefthook run pre-commit "$@"
elif [ -f "./node_modules/.bin/lefthook" ]; then
  ./node_modules/.bin/lefthook run pre-commit "$@"
else
  npx lefthook run pre-commit "$@"
fi
`;

    if (!fs.existsSync(preCommitPath) || lefthookSuccess) {
      if (!fs.existsSync(preCommitPath)) {
        fs.writeFileSync(preCommitPath, preCommitContent, { mode: 0o755 });
      }
      try {
        fs.chmodSync(preCommitPath, 0o755);
      } catch {
        // ignore chmod errors on windows
      }
      installedHooks.push('pre-commit');
    }

    // Ensure pre-push hook exists and is executable
    const prePushPath = path.resolve(hooksDir, 'pre-push');
    const prePushContent = `#!/bin/sh
# Agent-Proof Mechanical Hard-Gate Pre-Push Hook
if command -v lefthook >/dev/null 2>&1; then
  lefthook run pre-push "$@"
elif [ -f "./node_modules/.bin/lefthook" ]; then
  ./node_modules/.bin/lefthook run pre-push "$@"
else
  npx lefthook run pre-push "$@"
fi
`;

    if (!fs.existsSync(prePushPath)) {
      fs.writeFileSync(prePushPath, prePushContent, { mode: 0o755 });
      try {
        fs.chmodSync(prePushPath, 0o755);
      } catch {
        // ignore chmod errors on windows
      }
      installedHooks.push('pre-push');
    }

    return {
      lefthookInstalled: lefthookSuccess,
      gitHooksPath: hooksDir,
      installedHooks,
      message: lefthookSuccess
        ? 'Lefthook hooks successfully installed and verified.'
        : 'Git hooks generated with lefthook fallback wrapper.',
    };
  }
}

export function installHooks(options?: HookInstallerOptions): HookInstallResult {
  return new HookInstaller(options).install();
}
