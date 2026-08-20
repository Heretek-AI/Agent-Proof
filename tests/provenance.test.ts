import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProvenanceEngine, createAttestation } from '../src/attestation/provenance';

describe('ProvenanceEngine — In-Toto Attestation & Ephemeral Ed25519 Signing', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'provenance-test-'));
    fs.writeFileSync(path.join(tempDir, 'main.ts'), 'console.log("hello");\n');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('computes deterministic workspace SHA-256 digest', () => {
    const digest1 = ProvenanceEngine.computeWorkspaceDigest(tempDir);
    const digest2 = ProvenanceEngine.computeWorkspaceDigest(tempDir);

    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates and cryptographically verifies an in-toto Ed25519 attestation', () => {
    const attestation = createAttestation({
      cwd: tempDir,
      gateStage: 'PreCommit',
      status: 'PASSED',
      totalErrors: 0,
      totalWarnings: 0,
    });

    expect(attestation._type).toBe('https://in-toto.io/Statement/v0.1');
    expect(attestation.predicate.verifier).toBe('@heretek-ai/agent-proof');
    expect(attestation.predicate.status).toBe('PASSED');
    expect(attestation.signature.algorithm).toBe('Ed25519');

    // Cryptographic verification
    const isValid = ProvenanceEngine.verifyAttestation(attestation);
    expect(isValid).toBe(true);

    // Tampering test: modify digest and verify failure
    const tampered = JSON.parse(JSON.stringify(attestation));
    tampered.subject[0].digest.sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
    expect(ProvenanceEngine.verifyAttestation(tampered)).toBe(false);
  });
});
