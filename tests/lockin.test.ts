import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  GateLock,
  lockGovernance,
  unlockGovernance,
  getGovernanceStatus,
  HookInstaller,
  installHooks,
} from '../src/installer/index.js';

describe('GateLock & HookInstaller', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-gate-lock-test-'));
  });

  afterEach(() => {
    // Unlock before cleanup so rmSync does not fail on read-only files
    try {
      unlockGovernance(tempDir);
    } catch {
      // ignore
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('handles hook installation when .git directory is missing', () => {
    const result = installHooks({ cwd: tempDir });
    expect(result.lefthookInstalled).toBe(false);
    expect(result.installedHooks.length).toBe(0);
    expect(result.message).toContain('No .git repository found');
  });

  it('installs pre-commit and pre-push hooks when .git is present', () => {
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });

    const result = installHooks({ cwd: tempDir });
    expect(result.installedHooks).toContain('pre-commit');
    expect(result.installedHooks).toContain('pre-push');

    const preCommitPath = path.join(tempDir, '.git', 'hooks', 'pre-commit');
    const prePushPath = path.join(tempDir, '.git', 'hooks', 'pre-push');

    expect(fs.existsSync(preCommitPath)).toBe(true);
    expect(fs.existsSync(prePushPath)).toBe(true);

    const preCommitContent = fs.readFileSync(preCommitPath, 'utf-8');
    expect(preCommitContent).toContain('lefthook run pre-commit');
  });

  it('locks and unlocks governance files with permissions', () => {
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    const settingsPath = path.join(claudeDir, 'settings.json');
    const hooksPath = path.join(claudeDir, 'hooks.json');
    const lefthookPath = path.join(tempDir, 'lefthook.yml');

    fs.writeFileSync(settingsPath, '{"locked": true}');
    fs.writeFileSync(hooksPath, '{"hooks": {}}');
    fs.writeFileSync(lefthookPath, 'pre-commit:\n  parallel: true');

    const lock = new GateLock(tempDir);

    // Initial status
    let status = lock.getStatus();
    expect(status['.claude/settings.json'].exists).toBe(true);
    expect(status['.claude/settings.json'].isLocked).toBe(false);

    // Lock governance
    const lockResult = lock.lock();
    expect(lockResult.lockedFiles).toContain('.claude/settings.json');
    expect(lockResult.lockedFiles).toContain('.claude/hooks.json');
    expect(lockResult.lockedFiles).toContain('lefthook.yml');

    status = lock.getStatus();
    expect(status['.claude/settings.json'].isLocked).toBe(true);
    expect(status['.claude/hooks.json'].isLocked).toBe(true);
    expect(status['lefthook.yml'].isLocked).toBe(true);

    // Unlock governance
    const unlockResult = lock.unlock();
    expect(unlockResult.lockedFiles).toContain('.claude/settings.json');

    status = lock.getStatus();
    expect(status['.claude/settings.json'].isLocked).toBe(false);
  });
});
