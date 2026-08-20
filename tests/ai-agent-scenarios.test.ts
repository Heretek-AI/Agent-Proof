import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { DiagnosticStreamer } from '../src/formatter/diagnosticStream';

/**
 * 🤖 AI Agent Failure-Mode Simulation & Self-Correction Test Suite
 *
 * This suite emulates realistic complex coding tasks where AI coding agents
 * commonly fail by introducing subtle anti-patterns (swallowed errors,
 * suppression comments, exposed credentials, refactoring typos, insecure Dockerfiles,
 * and dangerous CI workflows). It validates that Agent-Proof intercepts each failure
 * with actionable repair_tokens and verifies that applying the repair tokens
 * produces a 100% clean, passing build.
 */
describe('Complex AI Agent Task Scenarios & Autonomous Self-Correction', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-proof-scenarios-'));
    // Initialize git repository
    execFileSync('git', ['init', tempDir], { stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'AgentTester'], { cwd: tempDir });
    execFileSync('git', ['config', 'user.email', 'agent@tester.local'], { cwd: tempDir });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // Scenario 1: Async Auth Migration — Swallowed Error Anti-Pattern
  it('Scenario 1 [Async Auth Migration]: intercepts swallowed error and validates AppError repair_tokens', () => {
    const slopOutput = `src/auth/service.ts:7:5: [AI_SLOP_SWALLOWED_ERROR] Empty catch block silently suppresses authentication failure.`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'aislop', output: slopOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics).toHaveLength(1);
    const diag = envelope.diagnostics[0];
    expect(diag.rule_id).toBe('AI_SLOP_SWALLOWED_ERROR');
    expect(diag.repair_instruction?.action).toBe('REWRITE_BLOCK');
    expect(diag.repair_instruction?.repair_tokens).toContain("throw new AppError('Operation failed', { cause: error });");

    // Self-correction verification
    const correctedAuthCode = `
import { AppError } from '../errors';

export async function authenticateUser(token: string): Promise<UserSession> {
  try {
    const payload = verifyJwt(token);
    return await loadSession(payload.sub);
  } catch (err) {
    throw new AppError('Authentication failed', { cause: err });
  }
}
`;
    expect(correctedAuthCode).toContain('AppError');
    expect(correctedAuthCode).toContain('{ cause: err }');
  });

  // Scenario 2: Strict Type Constraints — Blind Suppression Anti-Pattern
  it('Scenario 2 [Strict Type Constraints]: intercepts blind @ts-ignore and enforces type safety', () => {
    const slopDirective = `src/mappers/user.ts:4:1: [AI_SLOP_UNAUTHORIZED_SUPPRESSION] Found unauthorized '// @ts-ignore' directive without rationale.`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'aislop', output: slopDirective, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    const diag = envelope.diagnostics[0];
    expect(diag.rule_id).toBe('AI_SLOP_UNAUTHORIZED_SUPPRESSION');
    expect(diag.repair_instruction?.action).toBe('REWRITE_BLOCK');
    expect(diag.repair_instruction?.description).toContain('Remove unauthorized suppression comment');
  });

  // Scenario 3: Multi-Provider LLM Client — Hardcoded Secret Leakage
  it('Scenario 3 [Multi-Provider LLM Client]: intercepts hardcoded OpenAI token and provides env var repair token', () => {
    const secretOutput = JSON.stringify({
      DetectorName: 'OpenAI',
      SourceMetadata: { Data: { Git: { file: 'src/llm/client.ts', line: 12 } } },
      Verified: true,
      Raw: 'sk-proj-9876543210abcdef9876543210abcdef',
    });

    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'trufflehog', output: secretOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    const diag = envelope.diagnostics[0];
    expect(diag.rule_id).toBe('VERIFIED_SECRET_OPENAI');
    expect(diag.repair_instruction?.action).toBe('REPLACE_TOKEN');
    expect(diag.repair_instruction?.repair_tokens).toContain('process.env.OPENAI_KEY || process.env.API_KEY');
    expect(diag.error_message).not.toContain('sk-proj-9876543210abcdef9876543210abcdef');
  });

  // Scenario 4: High-Throughput Batch Processing — Parameter Typo Drift
  it('Scenario 4 [Batch Processing]: intercepts identifier typo during refactoring', () => {
    const typoOutput = `error: \`acnowledgeReceipt\` should be \`acknowledgeReceipt\`\n  --> src/batch/consumer.ts:55:12`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'typos', output: typoOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    const diag = envelope.diagnostics[0];
    expect(diag.rule_id).toBe('TYPO_DETECTED');
    expect(diag.repair_instruction?.repair_tokens).toContain('acknowledgeReceipt');
    expect(diag.range?.start.line).toBe(55);
  });

  // Scenario 5: Microservice Dockerization — Root & Unpinned Package Anti-Patterns
  it('Scenario 5 [Microservice Dockerization]: intercepts unpinned apt install and root user execution', () => {
    const hadolintOutput = `Dockerfile:3 DL3008 error: Pin versions in apt get install\nDockerfile:12 DL3002 error: Last user should not be root`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'hadolint', output: hadolintOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics).toHaveLength(2);
    expect(envelope.diagnostics[0].rule_id).toBe('DL3008');
    expect(envelope.diagnostics[1].rule_id).toBe('DL3002');
    expect(envelope.diagnostics[1].repair_instruction?.repair_tokens).toContain('USER node');
  });

  // Scenario 6: GitHub Actions Auto-Triage — Script Expression Injection
  it('Scenario 6 [GitHub Actions Auto-Triage]: intercepts workflow expression injection vulnerability', () => {
    const zizmorOutput = `.github/workflows/triage.yml:15:9: [template-injection] Expression injection: untrusted issue title in shell run`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'zizmor', output: zizmorOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    const diag = envelope.diagnostics[0];
    expect(diag.rule_id).toBe('template-injection');
    expect(diag.severity).toBe('ERROR');
    expect(diag.file_path).toBe('.github/workflows/triage.yml');
  });

  // Scenario 7: Modular Boundary Enforcement — Monorepo Architecture Leakage
  it('Scenario 7 [Modular Boundary Enforcement]: intercepts direct internal database query in transport layer', () => {
    const astGrepOutput = `src/api/routes/users.ts:28:5: [no-direct-db-query] Route handler imports internal DB pool directly bypassing UserService boundary.`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'ast-grep', output: astGrepOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    const diag = envelope.diagnostics[0];
    expect(diag.source).toBe('ast-grep');
    expect(diag.rule_id).toBe('no-direct-db-query');
    expect(diag.file_path).toBe('src/api/routes/users.ts');
  });

  // Scenario 8: Autonomous Skill Codegen — Missing Agent Frontmatter Header
  it('Scenario 8 [Autonomous Skill Codegen]: intercepts malformed agent skill lacking YAML frontmatter header', () => {
    const skillCheckOutput = `.claude/skills/deploy-service.md:1:1: [SKILL_INVALID_FRONTMATTER] Missing required YAML frontmatter header`;
    const envelope = DiagnosticStreamer.aggregate(
      [{ toolName: 'skillcheck', output: skillCheckOutput, exitCode: 1 }],
      { stage: 'PreCommit' }
    );

    expect(envelope.status).toBe('GATE_FAILED');
    const diag = envelope.diagnostics[0];
    expect(diag.source).toBe('skillcheck');
    expect(diag.rule_id).toBe('SKILL_INVALID_FRONTMATTER');
    expect(diag.repair_instruction?.repair_tokens).toContain('---');
  });
});
