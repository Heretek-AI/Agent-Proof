import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { detectStack } from '../src/detector/stackDetector.js';
import {
  ConfigGenerator,
  generateConfigs,
  generateLefthookConfig,
  generateClaudeHooksConfig,
  generateBiomeConfig,
  generateRuffConfig,
  generateAislopConfig,
} from '../src/generator/index.js';

describe('ConfigGenerator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-gate-generator-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates lefthook.yml with all required Stage 2 and Stage 3 engines for polyglot stack', () => {
    // Setup polyglot indicators
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ workspaces: ['apps/*'] }));
    fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');
    fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module app');
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');
    const wfDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'ci.yml'), '');

    const detection = detectStack(tempDir);
    const yaml = generateLefthookConfig(detection);

    // Stage 2 (Pre-Commit) assertions
    expect(yaml).toContain('pre-commit:');
    expect(yaml).toContain('parallel: true');
    expect(yaml).toContain('biome check --staged');
    expect(yaml).toContain('ruff check --staged --fix');
    expect(yaml).toContain('gosec -quiet ./...');
    expect(yaml).toContain('cargo deny check');
    expect(yaml).toContain('aislop scan --staged');
    expect(yaml).toContain('trufflehog git file://. --staged --only-verified');
    expect(yaml).toContain('typos --staged');
    expect(yaml).toContain('actionlint');

    // Stage 3 (Pre-Push / CI) assertions
    expect(yaml).toContain('pre-push:');
    expect(yaml).toContain('fallow audit');
    expect(yaml).toContain('setup-sherif');
    expect(yaml).toContain('noir scan . --ai-context -f sarif');
  });

  it('generates .claude/hooks.json with Stage 1 agent interceptors', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), '');

    const detection = detectStack(tempDir);
    const hooksJson = generateClaudeHooksConfig(detection);
    const parsed = JSON.parse(hooksJson);

    expect(parsed.hooks.PostFileEdit).toBeDefined();
    expect(parsed.hooks.PostFileEdit).toEqual(
      expect.arrayContaining([
        {
          matcher: '*.{js,ts,jsx,tsx}',
          command: 'npx @biomejs/biome check --write ${filePath}',
        },
        {
          matcher: '*.py',
          command: 'ruff check --fix ${filePath}',
        },
        {
          matcher: '.claude/skills/*.md',
          command: 'skillcheck check ${filePath}',
        },
        {
          matcher: 'SKILL.md',
          command: 'skillcheck check ${filePath}',
        },
      ])
    );

    expect(parsed.hooks.PreCommit).toEqual([
      {
        command: 'npx lefthook run pre-commit',
      },
    ]);
  });

  it('generates valid biome.json, ruff.toml, and .aislop/config.yml', () => {
    const biome = JSON.parse(generateBiomeConfig());
    expect(biome.formatter.enabled).toBe(true);
    expect(biome.linter.enabled).toBe(true);
    expect(biome.linter.rules.suspicious.noExplicitAny).toBe('warn');

    const ruff = generateRuffConfig();
    expect(ruff).toContain('line-length = 100');
    expect(ruff).toContain('select = [');
    expect(ruff).toContain('"B"');

    const aislop = generateAislopConfig();
    expect(aislop).toContain('fail_threshold: 50');
    expect(aislop).toContain('swallowed_errors:');
    expect(aislop).toContain('empty_catch_blocks:');
    expect(aislop).toContain('hallucinated_imports:');
  });

  it('writes all configuration files to disk safely and respects overwrite', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    const detection = detectStack(tempDir);

    const result1 = generateConfigs(detection, { cwd: tempDir });
    expect(result1.writtenFiles).toContain('lefthook.yml');
    expect(result1.writtenFiles).toContain('.claude/hooks.json');
    expect(result1.writtenFiles).toContain('.claude/settings.json');
    expect(result1.writtenFiles).toContain('biome.json');
    expect(result1.writtenFiles).toContain('.aislop/config.yml');

    // Second write without force should skip existing files
    const result2 = generateConfigs(detection, { cwd: tempDir, overwrite: false });
    expect(result2.writtenFiles.length).toBe(0);
    expect(result2.skippedFiles.length).toBeGreaterThan(0);

    // Third write with force should overwrite
    const result3 = generateConfigs(detection, { cwd: tempDir, overwrite: true });
    expect(result3.writtenFiles.length).toBeGreaterThan(0);
    expect(result3.skippedFiles.length).toBe(0);
  });
});
