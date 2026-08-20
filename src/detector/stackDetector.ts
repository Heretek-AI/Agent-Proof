/**
 * @file src/detector/stackDetector.ts
 * @description Multi-stack auto-detection engine for repository inspection.
 *
 * Scans the filesystem to detect active programming languages, build systems,
 * package managers, container infrastructure, CI workflows, and AI agent harnesses.
 * Provides deterministic metadata to configure mechanical hard gates.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StackDetectionResult } from '../types/index.js';

/**
 * Options for configuring the StackDetector instance
 */
export interface StackDetectorOptions {
  /** Working directory to inspect (defaults to process.cwd()) */
  cwd?: string;
}

/**
 * Multi-Stack Auto-Detection Engine.
 * Inspects a repository directory to identify language ecosystems,
 * monorepos, workflows, and agent harnesses.
 */
export class StackDetector {
  /** Resolved absolute path of the target repository root */
  private readonly rootPath: string;

  /**
   * Initialize a new StackDetector instance
   * @param options Configuration options including target working directory
   */
  constructor(options: StackDetectorOptions = {}) {
    this.rootPath = path.resolve(options.cwd || process.cwd());
  }

  /**
   * Run full multi-stack detection across the target repository.
   * Inspects JS/TS, Python, Go, Rust, Infrastructure, and Agent Harnesses.
   *
   * @returns Comprehensive StackDetectionResult object with boolean flags and file lists.
   */
  public detect(): StackDetectionResult {
    // 1. Inspect individual technology stacks
    const jsTs = this.detectJsTs();
    const python = this.detectPython();
    const go = this.detectGo();
    const rust = this.detectRust();
    const cpp = this.detectCpp();
    const csharp = this.detectCsharp();
    const java = this.detectJava();
    const ruby = this.detectRuby();
    const elixir = this.detectElixir();
    const infra = this.detectInfra();
    const agentHarness = this.detectAgentHarness();

    // 2. Assemble high-level primary stack list for summary reporting
    const primaryStacks: string[] = [];
    if (jsTs.detected) primaryStacks.push('JavaScript/TypeScript');
    if (python.detected) primaryStacks.push('Python');
    if (go.detected) primaryStacks.push('Go');
    if (rust.detected) primaryStacks.push('Rust');
    if (cpp.detected) primaryStacks.push('C/C++');
    if (csharp.detected) primaryStacks.push('C#/.NET');
    if (java.detected) primaryStacks.push('Java');
    if (ruby.detected) primaryStacks.push('Ruby');
    if (elixir.detected) primaryStacks.push('Elixir');
    if (infra.detected) primaryStacks.push('Workflows/Infra');
    if (agentHarness.detected) primaryStacks.push('Agent Harness');

    // 3. Compute total indicator count across all detected categories
    const totalIndicators =
      jsTs.files.length +
      python.files.length +
      go.files.length +
      rust.files.length +
      cpp.files.length +
      csharp.files.length +
      java.files.length +
      ruby.files.length +
      elixir.files.length +
      infra.workflowFiles.length +
      infra.dockerFiles.length +
      agentHarness.files.length;

    return {
      rootPath: this.rootPath,
      jsTs,
      python,
      go,
      rust,
      cpp,
      csharp,
      java,
      ruby,
      elixir,
      infra,
      agentHarness,
      summary: {
        primaryStacks,
        totalIndicators,
      },
    };
  }

  /**
   * Detect JavaScript and TypeScript ecosystem indicators.
   * Checks for package manifests, TypeScript configs, Biome configs, and monorepo configurations.
   */
  private detectJsTs() {
    // Canonical indicator files for JS/TS projects and package managers
    const indicators = [
      'package.json',
      'tsconfig.json',
      'biome.json',
      'biome.jsonc',
      'deno.json',
      'deno.jsonc',
      'bun.lockb',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'yarn.lock',
      'package-lock.json',
    ];

    const detectedFiles: string[] = [];
    let hasTypeScript = false;
    let hasBiome = false;
    let isMonorepo = false;
    let packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'deno' | undefined;

    // Check presence of indicator files on disk
    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    // Check for explicit TypeScript config
    if (this.fileExists('tsconfig.json')) {
      hasTypeScript = true;
    }

    // Check for existing Biome configuration
    if (this.fileExists('biome.json') || this.fileExists('biome.jsonc')) {
      hasBiome = true;
    }

    // Determine package manager by lockfile priority
    if (this.fileExists('pnpm-lock.yaml')) {
      packageManager = 'pnpm';
    } else if (this.fileExists('yarn.lock')) {
      packageManager = 'yarn';
    } else if (this.fileExists('bun.lockb')) {
      packageManager = 'bun';
    } else if (this.fileExists('deno.json') || this.fileExists('deno.jsonc')) {
      packageManager = 'deno';
    } else if (this.fileExists('package-lock.json')) {
      packageManager = 'npm';
    }

    // Determine monorepo workspace indicators (pnpm, lerna, turbo, nx)
    if (this.fileExists('pnpm-workspace.yaml') || this.fileExists('lerna.json') || this.fileExists('turbo.json') || this.fileExists('nx.json')) {
      isMonorepo = true;
    } else if (this.fileExists('package.json')) {
      try {
        // Read package.json to check for workspaces, dependencies, and packageManager field
        const pkgContent = JSON.parse(fs.readFileSync(this.resolvePath('package.json'), 'utf-8'));
        if (pkgContent.workspaces) {
          isMonorepo = true;
        }
        if (pkgContent.devDependencies?.typescript || pkgContent.dependencies?.typescript) {
          hasTypeScript = true;
        }
        if (pkgContent.devDependencies?.['@biomejs/biome'] || pkgContent.dependencies?.['@biomejs/biome']) {
          hasBiome = true;
        }
        if (!packageManager && pkgContent.packageManager) {
          const pm = String(pkgContent.packageManager).split('@')[0];
          if (['npm', 'pnpm', 'yarn', 'bun', 'deno'].includes(pm)) {
            packageManager = pm as any;
          }
        }
      } catch {
        // Silently continue if package.json cannot be parsed
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
      hasTypeScript,
      hasBiome,
      isMonorepo,
      packageManager,
    };
  }

  /**
   * Detect Python ecosystem indicators.
   * Checks for pyproject.toml, requirements.txt, Pipfile, poetry, and Ruff linter configurations.
   */
  private detectPython() {
    const indicators = [
      'pyproject.toml',
      'requirements.txt',
      'Pipfile',
      'Pipfile.lock',
      'setup.py',
      'setup.cfg',
      'poetry.lock',
      'uv.lock',
      'ruff.toml',
      '.ruff.toml',
      '.flake8',
    ];

    const detectedFiles: string[] = [];
    let hasPyproject = false;
    let hasRuffConfig = false;

    // Check presence of Python indicator files
    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    // Inspect pyproject.toml for [tool.ruff] table
    if (this.fileExists('pyproject.toml')) {
      hasPyproject = true;
      try {
        const content = fs.readFileSync(this.resolvePath('pyproject.toml'), 'utf-8');
        if (content.includes('[tool.ruff]')) {
          hasRuffConfig = true;
        }
      } catch {
        // Silently continue if pyproject.toml cannot be read
      }
    }

    // Check for dedicated ruff.toml configuration
    if (this.fileExists('ruff.toml') || this.fileExists('.ruff.toml')) {
      hasRuffConfig = true;
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
      hasPyproject,
      hasRuffConfig,
    };
  }

  /**
   * Detect Go ecosystem indicators (go.mod, go.sum, Gopkg.toml).
   */
  private detectGo() {
    const indicators = ['go.mod', 'go.sum', 'Gopkg.toml'];
    const detectedFiles: string[] = [];

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
    };
  }

  /**
   * Detect Rust ecosystem indicators (Cargo.toml, Cargo.lock, multi-crate workspaces).
   */
  private detectRust() {
    const indicators = ['Cargo.toml', 'Cargo.lock'];
    const detectedFiles: string[] = [];
    let isWorkspace = false;

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    // Check if Cargo.toml defines a [workspace]
    if (this.fileExists('Cargo.toml')) {
      try {
        const content = fs.readFileSync(this.resolvePath('Cargo.toml'), 'utf-8');
        if (content.includes('[workspace]')) {
          isWorkspace = true;
        }
      } catch {
        // Silently continue if Cargo.toml cannot be read
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
      isWorkspace,
    };
  }

  /**
   * Detect C/C++ ecosystem indicators (CMakeLists.txt, Makefile, compile_commands.json, conanfile.txt).
   */
  private detectCpp() {
    const indicators = ['CMakeLists.txt', 'Makefile', 'compile_commands.json', 'conanfile.txt', 'vcpkg.json'];
    const detectedFiles: string[] = [];

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
    };
  }

  /**
   * Detect C# / .NET ecosystem indicators (*.csproj, *.sln, global.json, Directory.Build.props).
   */
  private detectCsharp() {
    const indicators = ['global.json', 'Directory.Build.props', 'Directory.Build.targets'];
    const detectedFiles: string[] = [];

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    try {
      const files = fs.readdirSync(this.rootPath);
      for (const f of files) {
        if (f.endsWith('.sln') || f.endsWith('.csproj') || f.endsWith('.fsproj')) {
          detectedFiles.push(f);
        }
      }
    } catch {}

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
    };
  }

  /**
   * Detect Java ecosystem indicators (pom.xml, build.gradle, settings.gradle, gradlew).
   */
  private detectJava() {
    const indicators = ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts', 'gradlew'];
    const detectedFiles: string[] = [];

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
    };
  }

  /**
   * Detect Ruby ecosystem indicators (Gemfile, Gemfile.lock, .rubocop.yml, Rakefile).
   */
  private detectRuby() {
    const indicators = ['Gemfile', 'Gemfile.lock', '.rubocop.yml', 'Rakefile'];
    const detectedFiles: string[] = [];

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
    };
  }

  /**
   * Detect Elixir ecosystem indicators (mix.exs, mix.lock).
   */
  private detectElixir() {
    const indicators = ['mix.exs', 'mix.lock'];
    const detectedFiles: string[] = [];

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
    };
  }

  /**
   * Detect Infrastructure, CI workflows, and Docker container definitions.
   */
  private detectInfra() {
    const workflowFiles: string[] = [];
    const dockerFiles: string[] = [];

    // Scan .github/workflows directory for YAML workflow files
    const workflowsDir = this.resolvePath('.github/workflows');
    if (this.dirExists('.github/workflows')) {
      try {
        const files = fs.readdirSync(workflowsDir);
        for (const file of files) {
          if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            workflowFiles.push(path.join('.github/workflows', file));
          }
        }
      } catch {
        // Silently continue if workflows directory cannot be read
      }
    }

    // Check for Docker and container configuration files
    const dockerIndicators = [
      'Dockerfile',
      'Containerfile',
      'docker-compose.yml',
      'docker-compose.yaml',
      'compose.yml',
      'compose.yaml',
      '.gitlab-ci.yml',
    ];

    for (const ind of dockerIndicators) {
      if (this.fileExists(ind)) {
        dockerFiles.push(ind);
      }
    }

    return {
      detected: workflowFiles.length > 0 || dockerFiles.length > 0,
      hasWorkflows: workflowFiles.length > 0,
      workflowFiles,
      hasDocker: dockerFiles.length > 0,
      dockerFiles,
    };
  }

  /**
   * Detect AI agent harness files, skill markdown definitions, and instructions.
   */
  private detectAgentHarness() {
    const files: string[] = [];
    let hasClaude = false;
    let hasCursor = false;
    let hasSkillFiles = false;
    let hasAgentsMd = false;

    // Check for Claude Code harness directory and settings
    if (this.dirExists('.claude')) {
      hasClaude = true;
      files.push('.claude/');
      if (this.fileExists('.claude/settings.json')) files.push('.claude/settings.json');
      if (this.fileExists('.claude/hooks.json')) files.push('.claude/hooks.json');
    }

    // Check for CLAUDE.md instruction file
    if (this.fileExists('CLAUDE.md')) {
      hasClaude = true;
      files.push('CLAUDE.md');
    }

    // Check for Cursor IDE rules and directory
    if (this.dirExists('.cursor') || this.fileExists('.cursorrules')) {
      hasCursor = true;
      if (this.dirExists('.cursor')) files.push('.cursor/');
      if (this.fileExists('.cursorrules')) files.push('.cursorrules');
    }

    // Check for AGENTS.md multi-agent manifest
    if (this.fileExists('AGENTS.md')) {
      hasAgentsMd = true;
      files.push('AGENTS.md');
    }

    // Check for root SKILL.md definition
    if (this.fileExists('SKILL.md')) {
      hasSkillFiles = true;
      files.push('SKILL.md');
    }

    // Check for .claude/skills/*.md individual skill definitions
    const skillsDir = this.resolvePath('.claude/skills');
    if (this.dirExists('.claude/skills')) {
      try {
        const skillFiles = fs.readdirSync(skillsDir);
        for (const sf of skillFiles) {
          if (sf.endsWith('.md')) {
            hasSkillFiles = true;
            files.push(path.join('.claude/skills', sf));
          }
        }
      } catch {
        // Silently continue if skills directory cannot be read
      }
    }

    return {
      detected: files.length > 0,
      hasClaude,
      hasCursor,
      hasSkillFiles,
      hasAgentsMd,
      files,
    };
  }

  /**
   * Helper to check if a relative path exists and is a file
   */
  private fileExists(relPath: string): boolean {
    const fullPath = this.resolvePath(relPath);
    try {
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    } catch {
      return false;
    }
  }

  /**
   * Helper to check if a relative path exists and is a directory
   */
  private dirExists(relPath: string): boolean {
    const fullPath = this.resolvePath(relPath);
    try {
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Resolve a relative path against the repository root
   */
  private resolvePath(relPath: string): string {
    return path.resolve(this.rootPath, relPath);
  }
}

/**
 * Functional convenience wrapper to detect stacks in a repository
 * @param cwd Target directory (defaults to current working directory)
 */
export function detectStack(cwd?: string): StackDetectionResult {
  return new StackDetector({ cwd }).detect();
}
