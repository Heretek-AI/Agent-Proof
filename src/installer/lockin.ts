/**
 * @file src/installer/lockin.ts
 * @description POSIX File Permission Locker for mechanical governance boundaries.
 *
 * Enforces immutable read-only permissions (`0o444` / `r--r--r--`) on governance
 * configuration files (`.claude/settings.json`, `.claude/hooks.json`, `lefthook.yml`, etc.)
 * to mechanically prevent autonomous AI coding agents from tampering with, disabling, or
 * weakening hard gates.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LockResult } from '../types/index.js';

/**
 * List of critical governance files locked by default to prevent agent tampering
 */
export const GOVERNANCE_FILES = [
  '.claude/settings.json',
  '.claude/hooks.json',
  'lefthook.yml',
  'biome.json',
  'ruff.toml',
  '.aislop/config.yml',
];

/**
 * Options for configuring GateLock operations
 */
export interface GateLockOptions {
  /** Target repository root directory (defaults to process.cwd()) */
  cwd?: string;
  /** Custom list of file paths to lock or unlock */
  files?: string[];
}

/**
 * POSIX File Permission Manager for Mechanical Gate Governance.
 */
export class GateLock {
  /** Resolved absolute path of the target repository */
  private readonly rootPath: string;
  /** Files targeted for permission locking */
  private readonly targetFiles: string[];

  /**
   * Initialize a new GateLock instance
   * @param options Directory string or GateLockOptions object
   */
  constructor(options: string | GateLockOptions = {}) {
    if (typeof options === 'string') {
      this.rootPath = path.resolve(options);
      this.targetFiles = GOVERNANCE_FILES;
    } else {
      this.rootPath = path.resolve(options.cwd || process.cwd());
      this.targetFiles = options.files || GOVERNANCE_FILES;
    }
  }

  /**
   * Lock all governance files by applying read-only permissions (0o444).
   *
   * @returns LockResult detailing locked and failed files
   */
  public lock(): LockResult {
    const lockedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const relPath of this.targetFiles) {
      const fullPath = path.resolve(this.rootPath, relPath);
      if (fs.existsSync(fullPath)) {
        try {
          // 0o444 = read-only for owner, group, and others
          fs.chmodSync(fullPath, 0o444);
          lockedFiles.push(relPath);
        } catch {
          failedFiles.push(relPath);
        }
      }
    }

    return {
      lockedFiles,
      failedFiles,
      mode: 'locked',
    };
  }

  /**
   * Unlock governance files by restoring standard read/write permissions (0o644).
   * Allows human developers or administrative workflows to modify configs.
   *
   * @returns LockResult detailing unlocked and failed files
   */
  public unlock(): LockResult {
    const lockedFiles: string[] = [];
    const failedFiles: string[] = [];

    for (const relPath of this.targetFiles) {
      const fullPath = path.resolve(this.rootPath, relPath);
      if (fs.existsSync(fullPath)) {
        try {
          // 0o644 = read/write for owner, read-only for group/others
          fs.chmodSync(fullPath, 0o644);
          lockedFiles.push(relPath);
        } catch {
          failedFiles.push(relPath);
        }
      }
    }

    return {
      lockedFiles,
      failedFiles,
      mode: 'unlocked',
    };
  }

  /**
   * Check the current permission status of all governance files as an array.
   */
  public checkStatus(): Array<{ path: string; exists: boolean; isLocked: boolean; mode?: string }> {
    return this.targetFiles.map(relPath => {
      const fullPath = path.resolve(this.rootPath, relPath);
      if (!fs.existsSync(fullPath)) {
        return { path: relPath, exists: false, isLocked: false };
      }

      try {
        const stats = fs.statSync(fullPath);
        // If owner write bit (0o200) is NOT set, file is read-only / locked
        const isLocked = (stats.mode & 0o200) === 0;
        const modeStr = (stats.mode & 0o777).toString(8);
        return { path: relPath, exists: true, isLocked, mode: modeStr };
      } catch {
        return { path: relPath, exists: true, isLocked: false };
      }
    });
  }

  /**
   * Return a dictionary of governance file statuses keyed by relative file path.
   */
  public getStatus(): Record<string, { exists: boolean; isLocked: boolean; mode?: string }> {
    const result: Record<string, { exists: boolean; isLocked: boolean; mode?: string }> = {};
    for (const item of this.checkStatus()) {
      result[item.path] = item;
    }
    return result;
  }
}

/**
 * Functional convenience wrapper to lock governance files
 * @param cwd Target repository directory or options
 */
export function lockGovernance(cwd?: string | GateLockOptions): LockResult {
  return new GateLock(cwd).lock();
}

/**
 * Functional convenience wrapper to unlock governance files
 * @param cwd Target repository directory or options
 */
export function unlockGovernance(cwd?: string | GateLockOptions): LockResult {
  return new GateLock(cwd).unlock();
}

/**
 * Functional convenience wrapper to get governance status dictionary
 * @param cwd Target repository directory or options
 */
export function getGovernanceStatus(cwd?: string | GateLockOptions): Record<string, { exists: boolean; isLocked: boolean; mode?: string }> {
  return new GateLock(cwd).getStatus();
}
