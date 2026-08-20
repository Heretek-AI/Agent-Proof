/**
 * @file src/attestation/provenance.ts
 * @description In-Toto Compliant Cryptographic Attestation & Provenance Engine.
 *
 * Employs zero-runtime-dependency native Node.js crypto (`node:crypto`) to compute
 * workspace git tree SHA-256 digests and sign tamper-evident ActionProof capability
 * receipts using ephemeral Ed25519 keypairs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { ProvenanceAttestation, GateStage } from '../types/index.js';

export interface AttestationOptions {
  cwd?: string;
  gateStage?: GateStage;
  status?: 'PASSED' | 'FAILED';
  totalErrors?: number;
  totalWarnings?: number;
  privateKey?: string;
  publicKey?: string;
}

/**
 * In-Toto Cryptographic Provenance & Attestation Engine.
 */
export class ProvenanceEngine {
  /**
   * Generate an ephemeral Ed25519 keypair for signing gate verification receipts.
   */
  public static generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return { publicKey, privateKey };
  }

  /**
   * Compute a deterministic SHA-256 merkle-like root digest of all source files in the repository.
   *
   * @param cwd Target repository root directory
   * @returns Hex SHA-256 digest string
   */
  public static computeWorkspaceDigest(cwd: string = process.cwd()): string {
    const rootPath = path.resolve(cwd);
    const hashes: string[] = [];

    const scan = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      // Sort alphabetically for deterministic ordering
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        const rel = path.relative(rootPath, full).replace(/\\/g, '/');

        if (
          entry.name === '.git' ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '.agent-proof'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          scan(full);
        } else if (entry.isFile()) {
          try {
            const buf = fs.readFileSync(full);
            const h = crypto.createHash('sha256').update(rel).update(buf).digest('hex');
            hashes.push(h);
          } catch {}
        }
      }
    };

    scan(rootPath);

    return crypto.createHash('sha256').update(hashes.join('\n')).digest('hex');
  }

  /**
   * Create an in-toto compliant cryptographic attestation statement signed with Ed25519.
   *
   * @param options Attestation configuration options
   * @returns Signed ProvenanceAttestation object
   */
  public static createAttestation(options: AttestationOptions = {}): ProvenanceAttestation {
    const cwd = options.cwd || process.cwd();
    const workspaceDigest = ProvenanceEngine.computeWorkspaceDigest(cwd);
    const stage = options.gateStage || 'PreCommit';
    const status = options.status || 'PASSED';
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date().toISOString();

    const keys = (options.privateKey && options.publicKey)
      ? { privateKey: options.privateKey, publicKey: options.publicKey }
      : ProvenanceEngine.generateKeyPair();

    const predicatePayload = {
      verifier: '@heretek-ai/agent-proof',
      gateStage: stage,
      status,
      timestamp,
      nonce,
      diagnosticSummary: {
        totalErrors: options.totalErrors || 0,
        totalWarnings: options.totalWarnings || 0,
      },
    };

    const statementToSign = JSON.stringify({
      subjectDigest: workspaceDigest,
      predicate: predicatePayload,
    });

    const signature = crypto.sign(null, Buffer.from(statementToSign, 'utf-8'), keys.privateKey).toString('base64');

    const keyId = `key_${crypto.createHash('sha256').update(keys.publicKey).digest('hex').slice(0, 12)}`;

    return {
      _type: 'https://in-toto.io/Statement/v0.1',
      subject: [
        {
          name: 'workspace',
          digest: {
            sha256: workspaceDigest,
          },
        },
      ],
      predicateType: 'https://agent-proof.heretek.ai/attestation/v1',
      predicate: predicatePayload,
      signature: {
        keyId,
        algorithm: 'Ed25519',
        sig: signature,
        publicKey: keys.publicKey,
      },
    };
  }

  /**
   * Verify an in-toto provenance attestation statement.
   *
   * @param attestation Signed attestation object
   * @returns True if signature is cryptographically valid
   */
  public static verifyAttestation(attestation: ProvenanceAttestation): boolean {
    try {
      const statementToVerify = JSON.stringify({
        subjectDigest: attestation.subject[0]?.digest?.sha256,
        predicate: attestation.predicate,
      });

      const isValid = crypto.verify(
        null,
        Buffer.from(statementToVerify, 'utf-8'),
        attestation.signature.publicKey,
        Buffer.from(attestation.signature.sig, 'base64')
      );

      return isValid;
    } catch {
      return false;
    }
  }
}

/**
 * Functional convenience wrapper to create a provenance attestation
 */
export function createAttestation(options?: AttestationOptions): ProvenanceAttestation {
  return ProvenanceEngine.createAttestation(options);
}
