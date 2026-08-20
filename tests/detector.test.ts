import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { StackDetector, detectStack } from '../src/detector/stackDetector.js';

describe('StackDetector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-gate-detector-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects empty directory correctly', () => {
    const detector = new StackDetector({ cwd: tempDir });
    const result = detector.detect();

    expect(result.jsTs.detected).toBe(false);
    expect(result.python.detected).toBe(false);
    expect(result.go.detected).toBe(false);
    expect(result.rust.detected).toBe(false);
    expect(result.infra.detected).toBe(false);
    expect(result.agentHarness.detected).toBe(false);
    expect(result.summary.primaryStacks).toEqual([]);
    expect(result.summary.totalIndicators).toBe(0);
  });

  it('detects TypeScript and Biome in JS/TS project', () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'my-ts-app',
      devDependencies: {
        typescript: '^5.0.0',
        '@biomejs/biome': '^1.9.0'
      }
    }));
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'biome.json'), '{}');

    const result = detectStack(tempDir);

    expect(result.jsTs.detected).toBe(true);
    expect(result.jsTs.hasTypeScript).toBe(true);
    expect(result.jsTs.hasBiome).toBe(true);
    expect(result.jsTs.files).toContain('package.json');
    expect(result.jsTs.files).toContain('tsconfig.json');
    expect(result.jsTs.files).toContain('biome.json');
    expect(result.summary.primaryStacks).toContain('JavaScript/TypeScript');
  });

  it('detects monorepo in JS/TS project', () => {
    fs.writeFileSync(path.join(tempDir, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"');
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'monorepo-root',
      workspaces: ['packages/*']
    }));

    const result = detectStack(tempDir);
    expect(result.jsTs.detected).toBe(true);
    expect(result.jsTs.isMonorepo).toBe(true);
  });

  it('detects Python project with pyproject.toml and Ruff', () => {
    fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), `
[tool.poetry]
name = "python-app"

[tool.ruff]
line-length = 88
`);
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'requests==2.31.0');

    const result = detectStack(tempDir);
    expect(result.python.detected).toBe(true);
    expect(result.python.hasPyproject).toBe(true);
    expect(result.python.hasRuffConfig).toBe(true);
    expect(result.summary.primaryStacks).toContain('Python');
  });

  it('detects Go project', () => {
    fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module example.com/myapp\n\ngo 1.22\n');

    const result = detectStack(tempDir);
    expect(result.go.detected).toBe(true);
    expect(result.go.files).toContain('go.mod');
    expect(result.summary.primaryStacks).toContain('Go');
  });

  it('detects Rust project and workspace', () => {
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), `
[workspace]
members = ["crates/*"]
`);

    const result = detectStack(tempDir);
    expect(result.rust.detected).toBe(true);
    expect(result.rust.isWorkspace).toBe(true);
    expect(result.rust.files).toContain('Cargo.toml');
    expect(result.summary.primaryStacks).toContain('Rust');
  });

  it('detects Workflows and Docker Infra', () => {
    const workflowsDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    fs.writeFileSync(path.join(workflowsDir, 'ci.yml'), 'name: CI\non: push\n');
    fs.writeFileSync(path.join(workflowsDir, 'release.yaml'), 'name: Release\n');
    fs.writeFileSync(path.join(tempDir, 'Dockerfile'), 'FROM node:18\n');
    fs.writeFileSync(path.join(tempDir, 'docker-compose.yml'), 'version: "3.8"\n');

    const result = detectStack(tempDir);
    expect(result.infra.detected).toBe(true);
    expect(result.infra.hasWorkflows).toBe(true);
    expect(result.infra.workflowFiles.length).toBe(2);
    expect(result.infra.hasDocker).toBe(true);
    expect(result.infra.dockerFiles.length).toBe(2);
    expect(result.summary.primaryStacks).toContain('Workflows/Infra');
  });

  it('detects Agent Harness indicators', () => {
    const claudeSkills = path.join(tempDir, '.claude', 'skills');
    fs.mkdirSync(claudeSkills, { recursive: true });
    fs.writeFileSync(path.join(claudeSkills, 'git.md'), '# Git Skill');
    fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Agents');
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Skills');
    fs.writeFileSync(path.join(tempDir, '.cursorrules'), '# Cursor Rules');

    const result = detectStack(tempDir);
    expect(result.agentHarness.detected).toBe(true);
    expect(result.agentHarness.hasClaude).toBe(true);
    expect(result.agentHarness.hasCursor).toBe(true);
    expect(result.agentHarness.hasSkillFiles).toBe(true);
    expect(result.agentHarness.hasAgentsMd).toBe(true);
    expect(result.summary.primaryStacks).toContain('Agent Harness');
  });

  it('detects Polyglot repository with multiple stacks', () => {
    // JS/TS
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{"name":"polyglot"}');
    fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

    // Python
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'fastapi');

    // Rust
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "core"');

    // Infra
    const wfDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'main.yml'), 'name: Main');

    // Agent
    fs.writeFileSync(path.join(tempDir, 'SKILL.md'), '# Master Skill');

    const result = detectStack(tempDir);
    expect(result.jsTs.detected).toBe(true);
    expect(result.python.detected).toBe(true);
    expect(result.rust.detected).toBe(true);
    expect(result.infra.detected).toBe(true);
    expect(result.agentHarness.detected).toBe(true);
    expect(result.summary.primaryStacks).toEqual([
      'JavaScript/TypeScript',
      'Python',
      'Rust',
      'Workflows/Infra',
      'Agent Harness',
    ]);
  });

  it('detects C/C++, C#, Java, Ruby, and Elixir ecosystems', () => {
    fs.writeFileSync(path.join(tempDir, 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.10)');
    fs.writeFileSync(path.join(tempDir, 'App.csproj'), '<Project Sdk="Microsoft.NET.Sdk">');
    fs.writeFileSync(path.join(tempDir, 'pom.xml'), '<project></project>');
    fs.writeFileSync(path.join(tempDir, 'Gemfile'), 'source "https://rubygems.org"');
    fs.writeFileSync(path.join(tempDir, 'mix.exs'), 'defmodule App.MixProject do');

    const result = detectStack(tempDir);
    expect(result.cpp?.detected).toBe(true);
    expect(result.csharp?.detected).toBe(true);
    expect(result.java?.detected).toBe(true);
    expect(result.ruby?.detected).toBe(true);
    expect(result.elixir?.detected).toBe(true);
    expect(result.summary.primaryStacks).toContain('C/C++');
    expect(result.summary.primaryStacks).toContain('C#/.NET');
    expect(result.summary.primaryStacks).toContain('Java');
    expect(result.summary.primaryStacks).toContain('Ruby');
    expect(result.summary.primaryStacks).toContain('Elixir');
  });

  it('detects Docker, Terraform, Kubernetes, Tach, and ast-grep tools', () => {
    fs.writeFileSync(path.join(tempDir, 'Dockerfile'), 'FROM node:22-alpine');
    fs.writeFileSync(path.join(tempDir, 'main.tf'), 'resource "aws_s3_bucket" "b" {}');
    const k8sDir = path.join(tempDir, 'k8s');
    fs.mkdirSync(k8sDir, { recursive: true });
    fs.writeFileSync(path.join(k8sDir, 'deployment.yaml'), 'apiVersion: apps/v1');
    fs.writeFileSync(path.join(tempDir, 'tach.toml'), '[[modules]]');
    fs.writeFileSync(path.join(tempDir, 'sgconfig.yml'), 'ruleDirs: [rules]');

    const result = detectStack(tempDir);
    expect(result.infra.hasDocker).toBe(true);
    expect(result.infra.hasTerraform).toBe(true);
    expect(result.infra.hasKubernetes).toBe(true);
    expect(result.python.hasTach).toBe(true);
    expect(result.universal?.hasAstGrep).toBe(true);
  });
});
