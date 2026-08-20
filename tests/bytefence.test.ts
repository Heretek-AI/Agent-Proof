import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ByteFence, exactReplace } from '../src/broker/byteFence';

describe('ByteFence — Transactional Pre-Write Interceptor & Specification Freezer', () => {
  let tempDir: string;
  let fence: ByteFence;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bytefence-test-'));
    fence = new ByteFence(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('performs atomic exactReplace when preimage hash matches', () => {
    const filePath = 'src/service.ts';
    const fullPath = path.join(tempDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const initialContent = 'export const VERSION = "1.0.0";\n';
    fs.writeFileSync(fullPath, initialContent, 'utf-8');

    const newContent = 'export const VERSION = "1.1.0";\n';
    const receipt = fence.exactReplace({
      filePath,
      preimage: initialContent,
      candidate: newContent,
      role: 'Builder',
    });

    expect(receipt.status).toBe('COMMITTED');
    expect(receipt.receiptId).toContain('MEDIATED_PROVEN_');
    expect(fs.readFileSync(fullPath, 'utf-8')).toBe(newContent);
  });

  it('rejects mutation when declared preimage does not match disk content', () => {
    const filePath = 'src/config.ts';
    const fullPath = path.join(tempDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, 'port = 8080;\n', 'utf-8');

    const receipt = fence.exactReplace({
      filePath,
      preimage: 'port = 3000;\n', // Wrong preimage
      candidate: 'port = 9000;\n',
      role: 'Builder',
    });

    expect(receipt.status).toBe('REJECTED');
    expect(receipt.rejectionReason).toContain('PREIMAGE_MISMATCH');
    expect(fs.readFileSync(fullPath, 'utf-8')).toBe('port = 8080;\n');
  });

  it('freezes test directories and rejects Builder agent modifications (Proof-Loop role separation)', () => {
    const testFile = 'tests/auth.test.ts';
    const fullPath = path.join(tempDir, testFile);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, 'describe("auth", () => {});\n', 'utf-8');

    // Freeze specifications
    fence.freezeSpecifications();
    expect(fence.isPathFrozen(testFile)).toBe(true);

    // Attempt Builder mutation
    const receipt = fence.exactReplace({
      filePath: testFile,
      preimage: 'describe("auth", () => {});\n',
      candidate: 'describe("auth", () => { /* softened assertions */ });\n',
      role: 'Builder',
    });

    expect(receipt.status).toBe('REJECTED');
    expect(receipt.rejectionReason).toContain('SPEC_TEST_FROZEN');

    // Unfreeze allows verifier or admin update
    fence.unfreezeSpecifications();
    expect(fence.isPathFrozen(testFile)).toBe(false);
  });
});
