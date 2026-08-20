/**
 * @file src/broker/byteFence.ts
 * @description Transactional Pre-Write Interceptor & Specification Freezer (ByteFence Architecture).
 *
 * Enforces atomic raw-byte file modifications, preimage SHA-256 hashing,
 * and immutable role separation (Builder vs. Verifier) to prevent agents from
 * tampering with unit tests or specifications to force failing runs to pass.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ExactReplacePayload, WriteReceipt, FrozenSpecConfig } from '../types/index.js';

/** Default file patterns frozen from Builder agent mutation */
export const DEFAULT_FROZEN_PATTERNS = [
  'tests/**',
  '__tests__/**',
  'spec.md',
  'acceptance_criteria.json',
  'lefthook.yml',
  '.claude/**',
  'biome.json',
  'ruff.toml',
  '.aislop/**',
];

/**
 * ByteFence Transactional Write Broker.
 */
export class ByteFence {
  private readonly rootPath: string;
  private readonly specManifestPath: string;

  /**
   * Initialize ByteFence broker
   * @param cwd Target repository root directory
   */
  constructor(cwd: string = process.cwd()) {
    this.rootPath = path.resolve(cwd);
    this.specManifestPath = path.join(this.rootPath, '.agent-proof', 'frozen-spec.json');
  }

  /**
   * Compute SHA-256 hex digest of a string or Buffer
   */
  public static sha256(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check if a relative file path matches any glob pattern or frozen specification
   *
   * @param relPath Relative file path
   * @param patterns Array of glob patterns
   */
  public static matchesPattern(relPath: string, patterns: string[]): boolean {
    const normalized = relPath.replace(/\\/g, '/');
    for (const pattern of patterns) {
      const cleanPat = pattern.replace(/\\/g, '/');
      if (cleanPat.endsWith('/**')) {
        const prefix = cleanPat.slice(0, -3);
        if (normalized === prefix || normalized.startsWith(`${prefix}/`)) return true;
      } else if (cleanPat.startsWith('**/')) {
        const suffix = cleanPat.slice(3);
        if (normalized.endsWith(suffix) || normalized.includes(`/${suffix}`)) return true;
      } else if (cleanPat.startsWith('*.')) {
        const ext = cleanPat.slice(1);
        if (normalized.endsWith(ext)) return true;
      } else {
        if (normalized === cleanPat) return true;
      }
    }
    return false;
  }

  /**
   * Freeze test directories, specifications, and governance files into a read-only manifest.
   *
   * @param patterns Optional custom array of glob patterns to freeze
   * @returns FrozenSpecConfig manifest detailing frozen files and digests
   */
  public freezeSpecifications(patterns: string[] = DEFAULT_FROZEN_PATTERNS): FrozenSpecConfig {
    const pathDigests: Record<string, string> = {};

    // Scan repository for matching files
    const scanDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(this.rootPath, full).replace(/\\/g, '/');

        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }

        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile()) {
          if (ByteFence.matchesPattern(rel, patterns)) {
            const content = fs.readFileSync(full);
            pathDigests[rel] = ByteFence.sha256(content);
          }
        }
      }
    };

    scanDir(this.rootPath);

    const config: FrozenSpecConfig = {
      frozenPatterns: patterns,
      pathDigests,
      frozenAt: new Date().toISOString(),
    };

    const manifestDir = path.dirname(this.specManifestPath);
    if (!fs.existsSync(manifestDir)) {
      fs.mkdirSync(manifestDir, { recursive: true });
    }
    fs.writeFileSync(this.specManifestPath, JSON.stringify(config, null, 2), 'utf-8');

    return config;
  }

  /**
   * Unfreeze specifications (admin / verifier operation)
   */
  public unfreezeSpecifications(): boolean {
    if (fs.existsSync(this.specManifestPath)) {
      fs.unlinkSync(this.specManifestPath);
      return true;
    }
    return false;
  }

  /**
   * Check if a file is currently frozen against Builder mutations
   *
   * @param relPath File path relative to root
   */
  public isPathFrozen(relPath: string): boolean {
    const normalized = relPath.replace(/\\/g, '/');

    // 1. Check frozen manifest if exists
    if (fs.existsSync(this.specManifestPath)) {
      try {
        const raw = fs.readFileSync(this.specManifestPath, 'utf-8');
        const config: FrozenSpecConfig = JSON.parse(raw);
        if (ByteFence.matchesPattern(normalized, config.frozenPatterns)) {
          return true;
        }
        if (config.pathDigests && config.pathDigests[normalized]) {
          return true;
        }
      } catch {}
    }

    return false;
  }

  /**
   * Execute an atomic, preimage-verified file replacement under ByteFence mediation.
   *
   * @param payload ExactReplacePayload containing target path, preimage, and candidate
   * @returns WriteReceipt detailing commit status and cryptographic digests
   */
  public exactReplace(payload: ExactReplacePayload): WriteReceipt {
    const relPath = path.isAbsolute(payload.filePath)
      ? path.relative(this.rootPath, payload.filePath).replace(/\\/g, '/')
      : payload.filePath.replace(/\\/g, '/');
    const fullPath = path.resolve(this.rootPath, relPath);
    const role = payload.role || 'Builder';

    // 1. Enforce Role Separation & Specification Freezing
    if (role === 'Builder' && this.isPathFrozen(relPath)) {
      return {
        filePath: relPath,
        status: 'REJECTED',
        preimageSha256: '',
        candidateSha256: ByteFence.sha256(payload.candidate),
        receiptId: `REJECTED_${Date.now()}`,
        timestamp: new Date().toISOString(),
        rejectionReason: `SPEC_TEST_FROZEN: File '${relPath}' is frozen against Builder modifications under proof-loop role separation.`,
      };
    }

    // 2. Preimage Validation
    let currentBytes = Buffer.from('');
    let currentHash = '';

    if (fs.existsSync(fullPath)) {
      currentBytes = fs.readFileSync(fullPath);
      currentHash = ByteFence.sha256(currentBytes);
    }

    const expectedPreimageHash = payload.preimage.length === 64 && /^[0-9a-f]+$/i.test(payload.preimage)
      ? payload.preimage.toLowerCase()
      : ByteFence.sha256(payload.preimage);

    if (fs.existsSync(fullPath) && currentHash !== expectedPreimageHash) {
      return {
        filePath: relPath,
        status: 'REJECTED',
        preimageSha256: currentHash,
        candidateSha256: ByteFence.sha256(payload.candidate),
        receiptId: `REJECTED_${Date.now()}`,
        timestamp: new Date().toISOString(),
        rejectionReason: `PREIMAGE_MISMATCH: Current disk bytes digest (${currentHash.slice(0, 8)}) does not match declared preimage digest (${expectedPreimageHash.slice(0, 8)}).`,
      };
    }

    // 3. Atomic Write via Same-Directory Temporary File
    const candidateBytes = Buffer.from(payload.candidate, 'utf-8');
    const candidateHash = ByteFence.sha256(candidateBytes);
    const targetDir = path.dirname(fullPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const tempFile = path.join(targetDir, `.tmp.${path.basename(fullPath)}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`);

    try {
      fs.writeFileSync(tempFile, candidateBytes);
      // Atomic POSIX rename replaces target without race window
      fs.renameSync(tempFile, fullPath);

      const receiptId = `MEDIATED_PROVEN_${candidateHash.slice(0, 16).toUpperCase()}`;

      return {
        filePath: relPath,
        status: 'COMMITTED',
        preimageSha256: currentHash,
        candidateSha256: candidateHash,
        receiptId,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}

      return {
        filePath: relPath,
        status: 'REJECTED',
        preimageSha256: currentHash,
        candidateSha256: candidateHash,
        receiptId: `REJECTED_${Date.now()}`,
        timestamp: new Date().toISOString(),
        rejectionReason: `WRITE_IO_ERROR: ${err.message}`,
      };
    }
  }
}

/**
 * Functional convenience wrapper for ByteFence atomic replacement
 */
export function exactReplace(payload: ExactReplacePayload, cwd?: string): WriteReceipt {
  return new ByteFence(cwd).exactReplace(payload);
}
