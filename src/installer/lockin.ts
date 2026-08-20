import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LockResult } from '../types/index.js';

export const GOVERNANCE_FILES = [
  '.claude/settings.json',
  '.claude/hooks.json',
  'lefthook.yml',
  'biome.json',
  'ruff.toml',
  '.aislop/config.yml',
];

export class GateLock {
  private readonly rootPath: string;

  constructor(rootPath: string = process.cwd()) {
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * Lock governance files with read-only permissions to prevent AI agents from tampering with rules
   */
  public lock(files: string[] = GOVERNANCE_FILES): LockResult {
    const lockedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const relFile of files) {
      const fullPath = path.resolve(this.rootPath, relFile);
      if (!fs.existsSync(fullPath)) continue;

      try {
        // Mode 0o444 is read-only (r--r--r--)
        fs.chmodSync(fullPath, 0o444);
        lockedFiles.push(relFile);
      } catch {
        failedFiles.push(relFile);
      }
    }

    return {
      lockedFiles,
      failedFiles,
      mode: 'locked',
    };
  }

  /**
   * Unlock governance files with writeable permissions (for human administrator modifications)
   */
  public unlock(files: string[] = GOVERNANCE_FILES): LockResult {
    const lockedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const relFile of files) {
      const fullPath = path.resolve(this.rootPath, relFile);
      if (!fs.existsSync(fullPath)) continue;

      try {
        // Mode 0o644 is read/write for owner (rw-r--r--)
        fs.chmodSync(fullPath, 0o644);
        lockedFiles.push(relFile);
      } catch {
        failedFiles.push(relFile);
      }
    }

    return {
      lockedFiles,
      failedFiles,
      mode: 'unlocked',
    };
  }

  /**
   * Check whether governance files exist and are currently locked (read-only)
   */
  public getStatus(files: string[] = GOVERNANCE_FILES): Record<string, { exists: boolean; isLocked: boolean; mode?: number }> {
    const status: Record<string, { exists: boolean; isLocked: boolean; mode?: number }> = {};

    for (const relFile of files) {
      const fullPath = path.resolve(this.rootPath, relFile);
      if (!fs.existsSync(fullPath)) {
        status[relFile] = { exists: false, isLocked: false };
        continue;
      }

      try {
        const stats = fs.statSync(fullPath);
        // In POSIX, write permission bit for user is 0o200
        const isWritable = (stats.mode & 0o200) !== 0;
        status[relFile] = {
          exists: true,
          isLocked: !isWritable,
          mode: stats.mode,
        };
      } catch {
        status[relFile] = { exists: true, isLocked: false };
      }
    }

    return status;
  }
}

export function lockGovernance(rootPath?: string, files?: string[]): LockResult {
  return new GateLock(rootPath).lock(files);
}

export function unlockGovernance(rootPath?: string, files?: string[]): LockResult {
  return new GateLock(rootPath).unlock(files);
}

export function getGovernanceStatus(rootPath?: string, files?: string[]) {
  return new GateLock(rootPath).getStatus(files);
}
