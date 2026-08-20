import { describe, it, expect } from 'vitest';
import { DiagnosticStreamer } from '../src/formatter/diagnosticStream';
import { parseAislopOutput } from '../src/formatter/parsers/aislop';
import { parseBiomeOutput } from '../src/formatter/parsers/biome';
import { parseRuffOutput } from '../src/formatter/parsers/ruff';
import { parseSkillcheckOutput } from '../src/formatter/parsers/skillcheck';
import { parseTrufflehogOutput } from '../src/formatter/parsers/trufflehog';
import { parseTyposOutput } from '../src/formatter/parsers/typos';
import { parseActionlintOutput } from '../src/formatter/parsers/actionlint';
import { parseZizmorOutput } from '../src/formatter/parsers/zizmor';
import { parseHadolintOutput } from '../src/formatter/parsers/hadolint';
import { parseTfsecOutput, parseKubeScoreOutput } from '../src/formatter/parsers/iac';
import { parseAstGrepOutput } from '../src/formatter/parsers/astgrep';

describe('Exhaustive LSP Parsers Test Suite (11 Specialized Parsers)', () => {
  // 1. AISlop Parser
  describe('AISlop Parser', () => {
    it('parses swallowed errors, empty catches, and unhandled promises', () => {
      const output = `src/auth.ts:14:5: [AI_SLOP_SWALLOWED_ERROR] Empty catch block silently suppresses authentication failure.`;
      const diagnostics = parseAislopOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('aislop');
      expect(diagnostics[0].rule_id).toBe('AI_SLOP_SWALLOWED_ERROR');
      expect(diagnostics[0].severity).toBe('ERROR');
      expect(diagnostics[0].file_path).toBe('src/auth.ts');
      expect(diagnostics[0].range.start.line).toBe(14);
      expect(diagnostics[0].range.start.column).toBe(5);
      expect(diagnostics[0].repair_instruction?.action).toBe('REWRITE_BLOCK');
      expect(diagnostics[0].repair_instruction?.repair_tokens).toBeDefined();
    });

    it('parses unauthorized suppression comments (// @ts-ignore, # noqa, // biome-ignore)', () => {
      const output = `src/model.ts:8:1: [AI_SLOP_UNAUTHORIZED_SUPPRESSION] Found unauthorized '// @ts-ignore' directive without rationale.`;
      const diagnostics = parseAislopOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].rule_id).toBe('AI_SLOP_UNAUTHORIZED_SUPPRESSION');
      expect(diagnostics[0].repair_instruction?.action).toBe('REWRITE_BLOCK');
      expect(diagnostics[0].repair_instruction?.description).toContain('Remove unauthorized suppression comment');
    });

    it('handles empty or clean output without errors', () => {
      expect(parseAislopOutput('')).toEqual([]);
      expect(parseAislopOutput('No AI slop detected.')).toEqual([]);
    });
  });

  // 2. Biome Parser
  describe('Biome Parser', () => {
    it('parses Biome lint and format violations with suggested fixes', () => {
      const output = `src/utils.ts:25:9 lint/suspicious/noExplicitAny ━━━━━━━━━━━━━\n! The 'any' type should not be used.`;
      const diagnostics = parseBiomeOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('biome');
      expect(diagnostics[0].file_path).toBe('src/utils.ts');
      expect(diagnostics[0].range.start.line).toBe(25);
      expect(diagnostics[0].range.start.column).toBe(9);
      expect(diagnostics[0].repair_instruction?.suggested_command).toContain('biome check --write');
    });

    it('strips ANSI color escape sequences cleanly', () => {
      const ansiOutput = `\u001b[31msrc/index.ts:10:1\u001b[0m \u001b[33mlint/correctness/noUnusedVariables\u001b[0m\n✖ Variable 'foo' is unused.`;
      const diagnostics = parseBiomeOutput(ansiOutput);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].file_path).toBe('src/index.ts');
      expect(diagnostics[0].error_message).toContain("Variable 'foo' is unused.");
    });
  });

  // 3. Ruff Parser
  describe('Ruff Parser', () => {
    it('parses Python lint errors (unused imports, bare excepts)', () => {
      const output = `app/main.py:5:1: F401 [*] 'os' imported but unused\napp/main.py:18:5: E722 Do not use bare 'except'`;
      const diagnostics = parseRuffOutput(output);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0].rule_id).toBe('F401');
      expect(diagnostics[0].file_path).toBe('app/main.py');
      expect(diagnostics[0].repair_instruction?.suggested_command).toBe('ruff check --fix app/main.py');
      expect(diagnostics[1].rule_id).toBe('E722');
      expect(diagnostics[1].repair_instruction?.action).toBe('REWRITE_BLOCK');
    });
  });

  // 4. SkillCheck Parser
  describe('SkillCheck Parser', () => {
    it('parses invalid frontmatter and schema violations in agent skills', () => {
      const output = `SKILL.md:1:1: [SKILL_INVALID_FRONTMATTER] Missing required YAML frontmatter header`;
      const diagnostics = parseSkillcheckOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('skillcheck');
      expect(diagnostics[0].rule_id).toBe('SKILL_INVALID_FRONTMATTER');
      expect(diagnostics[0].repair_instruction?.repair_tokens).toContain('---');
    });
  });

  // 5. TruffleHog Parser
  describe('TruffleHog Parser', () => {
    it('parses verified high-entropy secrets and redacts raw token payloads', () => {
      const jsonLine = JSON.stringify({
        DetectorName: 'OpenAI',
        SourceMetadata: { Data: { Git: { file: 'src/config.ts', line: 12 } } },
        Verified: true,
        Raw: 'sk-proj-supersecretkey1234567890abcdef',
      });
      const diagnostics = parseTrufflehogOutput(jsonLine);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('trufflehog');
      expect(diagnostics[0].rule_id).toBe('VERIFIED_SECRET_OPENAI');
      expect(diagnostics[0].severity).toBe('ERROR');
      expect(diagnostics[0].file_path).toBe('src/config.ts');
      expect(diagnostics[0].error_message).toContain('[VERIFIED ACTIVE]');
      expect(diagnostics[0].error_message).not.toContain('sk-proj-supersecretkey1234567890abcdef');
      expect(diagnostics[0].repair_instruction?.action).toBe('REPLACE_TOKEN');
    });
  });

  // 6. Typos Parser
  describe('Typos Parser', () => {
    it('parses source identifier typos with accurate replacement tokens', () => {
      const output = `error: \`autorizationHeader\` should be \`authorizationHeader\`\n  --> server/middleware.ts:42:15`;
      const diagnostics = parseTyposOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('typos');
      expect(diagnostics[0].file_path).toBe('server/middleware.ts');
      expect(diagnostics[0].range.start.line).toBe(42);
      expect(diagnostics[0].range.start.column).toBe(15);
      expect(diagnostics[0].repair_instruction?.repair_tokens).toContain('authorizationHeader');
    });
  });

  // 7. Actionlint Parser
  describe('Actionlint Parser', () => {
    it('parses GitHub Actions syntax and shellcheck violations', () => {
      const output = `.github/workflows/deploy.yml:18:9: shellcheck reported issue in this script: SC2086: Double quote to prevent globbing [shellcheck]`;
      const diagnostics = parseActionlintOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('actionlint');
      expect(diagnostics[0].file_path).toBe('.github/workflows/deploy.yml');
      expect(diagnostics[0].range.start.line).toBe(18);
    });
  });

  // 8. Zizmor Parser
  describe('Zizmor Parser', () => {
    it('parses workflow security findings and unpinned action risks', () => {
      const output = `.github/workflows/triage.yml:22:7: [template-injection] Expression injection vulnerability detected in workflow run block`;
      const diagnostics = parseZizmorOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('zizmor');
      expect(diagnostics[0].rule_id).toBe('template-injection');
      expect(diagnostics[0].severity).toBe('ERROR');
      expect(diagnostics[0].file_path).toBe('.github/workflows/triage.yml');
      expect(diagnostics[0].range.start.line).toBe(22);
    });
  });

  // 9. Hadolint Parser
  describe('Hadolint Parser', () => {
    it('parses Dockerfile security anti-patterns (DL3008, DL3006, DL3002)', () => {
      const output = `Dockerfile:4 DL3008 warning: Pin versions in apt get install\nDockerfile:10 DL3002 warning: Last user should not be root`;
      const diagnostics = parseHadolintOutput(output);

      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0].source).toBe('hadolint');
      expect(diagnostics[0].rule_id).toBe('DL3008');
      expect(diagnostics[0].file_path).toBe('Dockerfile');
      expect(diagnostics[0].range.start.line).toBe(4);
      expect(diagnostics[1].rule_id).toBe('DL3002');
      expect(diagnostics[1].repair_instruction?.repair_tokens).toContain('USER node');
    });
  });

  // 10. IaC (tfsec / kube-score) Parser
  describe('IaC Parser (tfsec / kube-score)', () => {
    it('parses Terraform tfsec unencrypted resource alerts', () => {
      const output = `infra/storage.tf:12 [HIGH] Resource does not have encryption enabled (aws-s3-enable-bucket-encryption)`;
      const diagnostics = parseTfsecOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('tfsec');
      expect(diagnostics[0].file_path).toBe('infra/storage.tf');
      expect(diagnostics[0].severity).toBe('ERROR');
    });

    it('parses Kubernetes kube-score container privileges violations', () => {
      const output = `[CRITICAL] Container Security Context (container-security-context)`;
      const diagnostics = parseKubeScoreOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('kube-score');
      expect(diagnostics[0].severity).toBe('ERROR');
    });
  });

  // 11. AST-Grep Parser
  describe('AST-Grep Parser', () => {
    it('parses structural AST search violations with rule IDs and lines', () => {
      const output = `src/database.ts:15:3: [no-direct-db-query] Found unparameterized direct SQL query construction.`;
      const diagnostics = parseAstGrepOutput(output);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].source).toBe('ast-grep');
      expect(diagnostics[0].rule_id).toBe('no-direct-db-query');
      expect(diagnostics[0].file_path).toBe('src/database.ts');
      expect(diagnostics[0].range.start.line).toBe(15);
      expect(diagnostics[0].repair_instruction?.description).toContain('no-direct-db-query');
    });
  });
});
