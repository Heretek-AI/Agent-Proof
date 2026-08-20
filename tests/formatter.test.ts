import { describe, it, expect } from 'vitest';
import {
  stripAnsi,
  formatDiagnostics,
  DiagnosticStreamer,
  parseAislopOutput,
  parseBiomeOutput,
  parseRuffOutput,
  parseSkillcheckOutput,
  parseTrufflehogOutput,
  parseTyposOutput,
  parseActionlintOutput,
} from '../src/formatter/index.js';

describe('Diagnostic Streamer & Formatter', () => {
  it('strips ANSI color codes properly', () => {
    const raw = '\u001b[31mError:\u001b[39m \u001b[1mSomething failed\u001b[22m';
    expect(stripAnsi(raw)).toBe('Error: Something failed');
  });

  it('formats AISlop empty catch and swallowed error with repair tokens', () => {
    const raw = `src/controllers/auth.ts:88:7: [AI_SLOP_SWALLOWED_ERROR] Empty catch block silently suppresses authentication failure.`;
    const envelope = formatDiagnostics(raw, { toolName: 'aislop', stage: 'PreCommit' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.summary.total_errors).toBe(1);
    expect(envelope.summary.gate_stage).toBe('PreCommit');
    expect(envelope.$schema).toBe('https://json.schemastore.org/lsif.json');

    const diag = envelope.diagnostics[0];
    expect(diag.source).toBe('aislop');
    expect(diag.rule_id).toBe('AI_SLOP_SWALLOWED_ERROR');
    expect(diag.file_path).toBe('src/controllers/auth.ts');
    expect(diag.range?.start.line).toBe(88);
    expect(diag.range?.start.column).toBe(7);
    expect(diag.repair_instruction?.action).toBe('REWRITE_BLOCK');
    expect(diag.repair_instruction?.repair_tokens.length).toBeGreaterThan(0);
    expect(diag.repair_instruction?.repair_tokens.some(t => t.includes('Error'))).toBe(true);
  });

  it('formats AISlop JSON payload with rich metadata', () => {
    const jsonOutput = JSON.stringify({
      issues: [
        {
          rule_id: 'AI_SLOP_SWALLOWED_ERROR',
          severity: 'error',
          file_path: 'src/auth.ts',
          line: 88,
          column: 7,
          code_snippet: 'try { verify(); } catch(e) {}',
          error_message: 'Empty catch block',
        }
      ]
    });

    const envelope = formatDiagnostics(jsonOutput, { toolName: 'aislop' });
    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].code_snippet).toBe('try { verify(); } catch(e) {}');
    expect(envelope.diagnostics[0].range?.start.line).toBe(88);
  });

  it('formats Biome lint violation with repair instructions', () => {
    const raw = `src/index.ts:12:5 lint/suspicious/noExplicitAny ━━━━━━━━━━━━━━━━━━━━
✖ Avoid using any.`;

    const envelope = formatDiagnostics(raw, { toolName: 'biome', stage: 'PostFileEdit' });
    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.summary.gate_stage).toBe('PostFileEdit');
    expect(envelope.diagnostics[0].source).toBe('biome');
    expect(envelope.diagnostics[0].rule_id).toBe('lint/suspicious/noExplicitAny');
    expect(envelope.diagnostics[0].repair_instruction?.repair_tokens).toContain('unknown');
  });

  it('formats Ruff Python violations with repair tokens', () => {
    const raw = `src/api.py:10:1: F401 [*] 'os' imported but unused
src/api.py:25:5: E722 Do not use bare 'except'`;

    const envelope = formatDiagnostics(raw, { toolName: 'ruff' });
    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.summary.total_errors).toBe(2);

    const f401 = envelope.diagnostics.find(d => d.rule_id === 'F401');
    expect(f401?.file_path).toBe('src/api.py');
    expect(f401?.repair_instruction?.action).toBe('DELETE_LINE');

    const e722 = envelope.diagnostics.find(d => d.rule_id === 'E722');
    expect(e722?.repair_instruction?.action).toBe('REWRITE_BLOCK');
    expect(e722?.repair_instruction?.repair_tokens[0]).toContain('except Exception');
  });

  it('formats SkillCheck frontmatter and security violations', () => {
    const raw = `.claude/skills/deploy.md:1:1: [SKILL_INVALID_FRONTMATTER] Missing required 'name' or 'description'`;
    const envelope = formatDiagnostics(raw, { toolName: 'skillcheck' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].rule_id).toBe('SKILL_INVALID_FRONTMATTER');
    expect(envelope.diagnostics[0].repair_instruction?.repair_tokens).toContain('---');
  });

  it('formats TruffleHog verified secret detections', () => {
    const raw = `{"DetectorName": "AWS", "SourceMetadata": {"Data": {"Git": {"file": "src/config.ts", "line": 42}}}, "Verified": true}`;
    const envelope = formatDiagnostics(raw, { toolName: 'trufflehog' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].rule_id).toBe('VERIFIED_SECRET_AWS');
    expect(envelope.diagnostics[0].file_path).toBe('src/config.ts');
    expect(envelope.diagnostics[0].repair_instruction?.action).toBe('REPLACE_TOKEN');
    expect(envelope.diagnostics[0].repair_instruction?.repair_tokens[0]).toContain('process.env.AWS_KEY');
  });

  it('formats Typos spelling mistakes with replacement tokens', () => {
    const raw = `error: \`recieve\` should be \`receive\`
  --> src/utils.ts:4:12`;

    const envelope = formatDiagnostics(raw, { toolName: 'typos' });
    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].rule_id).toBe('TYPO_DETECTED');
    expect(envelope.diagnostics[0].file_path).toBe('src/utils.ts');
    expect(envelope.diagnostics[0].repair_instruction?.repair_tokens).toEqual(['receive']);
  });

  it('formats Actionlint workflow syntax errors', () => {
    const raw = `.github/workflows/ci.yml:15:3: syntax error: unexpected key "foo" [syntax-check]`;
    const envelope = formatDiagnostics(raw, { toolName: 'actionlint' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].source).toBe('actionlint');
    expect(envelope.diagnostics[0].file_path).toBe('.github/workflows/ci.yml');
    expect(envelope.diagnostics[0].range?.start.line).toBe(15);
  });

  it('aggregates multi-tool outputs into a single unified envelope', () => {
    const toolResults = [
      {
        toolName: 'biome',
        exitCode: 0,
        output: 'Checked 10 files. No errors.',
      },
      {
        toolName: 'aislop',
        exitCode: 1,
        output: 'src/service.ts:50:2: [AI_SLOP_UNSAFE_CAST] Unsafe cast to any',
      },
      {
        toolName: 'ruff',
        exitCode: 1,
        output: 'src/handler.py:1:1: F401 [*] sys imported but unused',
      },
    ];

    const envelope = DiagnosticStreamer.aggregate(toolResults, { stage: 'PreCommit' });
    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.summary.total_errors).toBe(2);
    expect(envelope.diagnostics.length).toBe(2);
    expect(envelope.diagnostics.some(d => d.source === 'aislop')).toBe(true);
    expect(envelope.diagnostics.some(d => d.source === 'ruff')).toBe(true);
  });

  it('returns GATE_PASSED when output has no errors', () => {
    const envelope = formatDiagnostics('', { stage: 'PreCommit' });
    expect(envelope.status).toBe('GATE_PASSED');
    expect(envelope.summary.total_errors).toBe(0);
    expect(envelope.diagnostics.length).toBe(0);
  });

  it('formats zizmor workflow security findings', () => {
    const raw = `.github/workflows/deploy.yml:24:9: [unpinned-uses] unpinned action usage`;
    const envelope = formatDiagnostics(raw, { toolName: 'zizmor' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].source).toBe('zizmor');
    expect(envelope.diagnostics[0].rule_id).toBe('unpinned-uses');
    expect(envelope.diagnostics[0].file_path).toBe('.github/workflows/deploy.yml');
    expect(envelope.diagnostics[0].repair_instruction?.repair_tokens[0]).toContain('actions/checkout@');
  });

  it('formats hadolint Dockerfile static analysis errors', () => {
    const raw = `Dockerfile:10 DL3008 warning: Pin versions in apt get install`;
    const envelope = formatDiagnostics(raw, { toolName: 'hadolint' });

    expect(envelope.status).toBe('GATE_PASSED'); // warning severity
    expect(envelope.diagnostics[0].source).toBe('hadolint');
    expect(envelope.diagnostics[0].rule_id).toBe('DL3008');
    expect(envelope.diagnostics[0].repair_instruction?.repair_tokens[0]).toContain('apt-get install');
  });

  it('formats tfsec IaC security violations', () => {
    const raw = `terraform/main.tf:15 [HIGH] S3 Bucket Encryption disabled (aws-s3-enable-bucket-encryption)`;
    const envelope = formatDiagnostics(raw, { toolName: 'tfsec' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].source).toBe('tfsec');
    expect(envelope.diagnostics[0].rule_id).toBe('aws-s3-enable-bucket-encryption');
  });

  it('formats suppression hygiene violations in AISlop', () => {
    const raw = `src/auth.ts:12:1: [AI_SLOP_UNAUTHORIZED_SUPPRESSION] Unauthorized @ts-ignore suppression comment`;
    const envelope = formatDiagnostics(raw, { toolName: 'aislop' });

    expect(envelope.status).toBe('GATE_FAILED');
    expect(envelope.diagnostics[0].rule_id).toBe('AI_SLOP_UNAUTHORIZED_SUPPRESSION');
    expect(envelope.diagnostics[0].repair_instruction?.action).toBe('REWRITE_BLOCK');
  });
});
