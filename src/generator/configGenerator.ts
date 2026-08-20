import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratedConfig, GenerationResult, StackDetectionResult } from '../types/index.js';
import { generateLefthookConfig } from './templates/lefthook.js';
import { generateClaudeHooksConfig, generateClaudeSettingsConfig } from './templates/claudeHooks.js';
import { generateBiomeConfig } from './templates/biome.js';
import { generateRuffConfig } from './templates/ruff.js';
import { generateAislopConfig } from './templates/aislop.js';

export interface ConfigGeneratorOptions {
  cwd?: string;
  overwrite?: boolean;
}

export class ConfigGenerator {
  private readonly rootPath: string;
  private readonly overwrite: boolean;

  constructor(options: ConfigGeneratorOptions = {}) {
    this.rootPath = path.resolve(options.cwd || process.cwd());
    this.overwrite = options.overwrite ?? false;
  }

  /**
   * Compute configuration files to be generated for the detected stack
   */
  public generate(detection: StackDetectionResult): GeneratedConfig[] {
    const configs: GeneratedConfig[] = [];

    // 1. Lefthook Orchestration Config (Stage 2 & Stage 3)
    configs.push({
      path: 'lefthook.yml',
      content: generateLefthookConfig(detection),
      description: 'Lefthook Multi-Stage Mechanical Hard-Gate Orchestrator',
      isImmutable: true,
    });

    // 2. Claude Agent Hooks Config (Stage 1 Agent Tool Interception)
    configs.push({
      path: '.claude/hooks.json',
      content: generateClaudeHooksConfig(detection),
      description: 'Claude Code Stage 1 Lifecycle Hook Interceptors',
      isImmutable: true,
    });

    // 3. Claude Settings Config (Locked agent governance settings)
    configs.push({
      path: '.claude/settings.json',
      content: generateClaudeSettingsConfig(),
      description: 'Claude Code Governance Configuration',
      isImmutable: true,
    });

    // 4. Biome Config (if JS/TS detected and not already present)
    if (detection.jsTs.detected && !detection.jsTs.hasBiome) {
      configs.push({
        path: 'biome.json',
        content: generateBiomeConfig(),
        description: 'Biome Sub-Millisecond Linter & Formatter Configuration',
      });
    }

    // 5. Ruff Config (if Python detected and not already present)
    if (detection.python.detected && !detection.python.hasRuffConfig) {
      configs.push({
        path: 'ruff.toml',
        content: generateRuffConfig(),
        description: 'Ruff Sub-Millisecond Python Linter & Formatter Configuration',
      });
    }

    // 6. AISlop Config (Universal AI smell and slop detection)
    configs.push({
      path: '.aislop/config.yml',
      content: generateAislopConfig(),
      description: 'AISlop Deterministic AI Slop & Swallowed Error Rules',
    });

    return configs;
  }

  /**
   * Write generated configurations to disk
   */
  public writeToDisk(detection: StackDetectionResult): GenerationResult {
    const configs = this.generate(detection);
    const writtenFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const config of configs) {
      const fullPath = path.resolve(this.rootPath, config.path);
      const dirName = path.dirname(fullPath);

      if (fs.existsSync(fullPath) && !this.overwrite) {
        skippedFiles.push(config.path);
        continue;
      }

      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }

      fs.writeFileSync(fullPath, config.content, 'utf-8');
      writtenFiles.push(config.path);
    }

    return {
      configs,
      writtenFiles,
      skippedFiles,
    };
  }
}

export function generateConfigs(detection: StackDetectionResult, options?: ConfigGeneratorOptions): GenerationResult {
  return new ConfigGenerator(options).writeToDisk(detection);
}
