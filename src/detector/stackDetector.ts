import * as fs from 'node:fs';
import * as path from 'node:path';
import type { StackDetectionResult } from '../types/index.js';

export interface StackDetectorOptions {
  cwd?: string;
}

export class StackDetector {
  private readonly rootPath: string;

  constructor(options: StackDetectorOptions = {}) {
    this.rootPath = path.resolve(options.cwd || process.cwd());
  }

  /**
   * Run full stack detection across the target repository
   */
  public detect(): StackDetectionResult {
    const jsTs = this.detectJsTs();
    const python = this.detectPython();
    const go = this.detectGo();
    const rust = this.detectRust();
    const infra = this.detectInfra();
    const agentHarness = this.detectAgentHarness();

    const primaryStacks: string[] = [];
    if (jsTs.detected) primaryStacks.push('JavaScript/TypeScript');
    if (python.detected) primaryStacks.push('Python');
    if (go.detected) primaryStacks.push('Go');
    if (rust.detected) primaryStacks.push('Rust');
    if (infra.detected) primaryStacks.push('Workflows/Infra');
    if (agentHarness.detected) primaryStacks.push('Agent Harness');

    const totalIndicators =
      jsTs.files.length +
      python.files.length +
      go.files.length +
      rust.files.length +
      infra.workflowFiles.length +
      infra.dockerFiles.length +
      agentHarness.files.length;

    return {
      rootPath: this.rootPath,
      jsTs,
      python,
      go,
      rust,
      infra,
      agentHarness,
      summary: {
        primaryStacks,
        totalIndicators,
      },
    };
  }

  private detectJsTs() {
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

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    if (this.fileExists('tsconfig.json')) {
      hasTypeScript = true;
    }

    if (this.fileExists('biome.json') || this.fileExists('biome.jsonc')) {
      hasBiome = true;
    }

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

    if (this.fileExists('pnpm-workspace.yaml') || this.fileExists('lerna.json') || this.fileExists('turbo.json') || this.fileExists('nx.json')) {
      isMonorepo = true;
    } else if (this.fileExists('package.json')) {
      try {
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
        // ignore parse error
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

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    if (this.fileExists('pyproject.toml')) {
      hasPyproject = true;
      try {
        const content = fs.readFileSync(this.resolvePath('pyproject.toml'), 'utf-8');
        if (content.includes('[tool.ruff]')) {
          hasRuffConfig = true;
        }
      } catch {
        // ignore read error
      }
    }

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

  private detectRust() {
    const indicators = ['Cargo.toml', 'Cargo.lock'];
    const detectedFiles: string[] = [];
    let isWorkspace = false;

    for (const indicator of indicators) {
      if (this.fileExists(indicator)) {
        detectedFiles.push(indicator);
      }
    }

    if (this.fileExists('Cargo.toml')) {
      try {
        const content = fs.readFileSync(this.resolvePath('Cargo.toml'), 'utf-8');
        if (content.includes('[workspace]')) {
          isWorkspace = true;
        }
      } catch {
        // ignore read error
      }
    }

    return {
      detected: detectedFiles.length > 0,
      files: detectedFiles,
      isWorkspace,
    };
  }

  private detectInfra() {
    const workflowFiles: string[] = [];
    const dockerFiles: string[] = [];

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
        // ignore read error
      }
    }

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

  private detectAgentHarness() {
    const files: string[] = [];
    let hasClaude = false;
    let hasCursor = false;
    let hasSkillFiles = false;
    let hasAgentsMd = false;

    if (this.dirExists('.claude')) {
      hasClaude = true;
      files.push('.claude/');
      if (this.fileExists('.claude/settings.json')) files.push('.claude/settings.json');
      if (this.fileExists('.claude/hooks.json')) files.push('.claude/hooks.json');
    }

    if (this.fileExists('CLAUDE.md')) {
      hasClaude = true;
      files.push('CLAUDE.md');
    }

    if (this.dirExists('.cursor') || this.fileExists('.cursorrules')) {
      hasCursor = true;
      if (this.dirExists('.cursor')) files.push('.cursor/');
      if (this.fileExists('.cursorrules')) files.push('.cursorrules');
    }

    if (this.fileExists('AGENTS.md')) {
      hasAgentsMd = true;
      files.push('AGENTS.md');
    }

    if (this.fileExists('SKILL.md')) {
      hasSkillFiles = true;
      files.push('SKILL.md');
    }

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
        // ignore read error
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

  private fileExists(relPath: string): boolean {
    const fullPath = this.resolvePath(relPath);
    try {
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    } catch {
      return false;
    }
  }

  private dirExists(relPath: string): boolean {
    const fullPath = this.resolvePath(relPath);
    try {
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    } catch {
      return false;
    }
  }

  private resolvePath(relPath: string): string {
    return path.resolve(this.rootPath, relPath);
  }
}

export function detectStack(cwd?: string): StackDetectionResult {
  return new StackDetector({ cwd }).detect();
}
