/**
 * @file src/generator/configGenerator.ts
 * @description Configuration and multi-tier pipeline generator engine.
 *
 * Emits deterministic configuration files matching detected repository stacks:
 * - lefthook.yml: Multi-threaded parallel git hook runner
 * - .claude/hooks.json: Stage 1 agent lifecycle tool interceptor
 * - .claude/settings.json: Locked agent governance settings
 * - biome.json: Biome sub-millisecond JS/TS linter/formatter config
 * - ruff.toml: Ruff sub-millisecond Python linter/formatter config
 * - .aislop/config.yml: AISlop deterministic code smell rules
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GeneratedConfig, GenerationResult, StackDetectionResult } from '../types/index.js';
import { generateLefthookConfig } from './templates/lefthook.js';
import { generateClaudeHooksConfig, generateClaudeSettingsConfig } from './templates/claudeHooks.js';
import { generateBiomeConfig } from './templates/biome.js';
import { generateRuffConfig } from './templates/ruff.js';
import { generateAislopConfig } from './templates/aislop.js';

/**
 * Options for configuring the ConfigGenerator instance
 */
export interface ConfigGeneratorOptions {
  /** Target root directory for configuration generation (defaults to process.cwd()) */
  cwd?: string;
  /** If true, existing configuration files will be overwritten */
  overwrite?: boolean;
}

/**
 * Multi-Tier Pipeline Configuration Generator.
 * Translates StackDetectionResult metadata into concrete, deterministic config files.
 */
export class ConfigGenerator {
  /** Resolved absolute path of the target repository root */
  private readonly rootPath: string;
  /** Whether to overwrite existing files on disk */
  private readonly overwrite: boolean;

  /**
   * Initialize a new ConfigGenerator instance
   * @param options Generator configuration options
   */
  constructor(options: ConfigGeneratorOptions = {}) {
    this.rootPath = path.resolve(options.cwd || process.cwd());
    this.overwrite = options.overwrite ?? false;
  }

  /**
   * Compute configuration files to be generated for the detected stacks without writing to disk.
   *
   * @param detection Stack detection result containing language and workflow indicators
   * @returns Array of GeneratedConfig objects with paths, contents, and descriptions
   */
  public generate(detection: StackDetectionResult): GeneratedConfig[] {
    const configs: GeneratedConfig[] = [];

    // 1. Lefthook Git Hook Runner Config (Stage 2 Pre-Commit & Stage 3 Pre-Push)
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
   * Write generated configurations to disk, creating parent directories as needed.
   *
   * @param detection Stack detection result
   * @returns GenerationResult containing written and skipped file lists
   */
  public writeToDisk(detection: StackDetectionResult): GenerationResult {
    const configs = this.generate(detection);
    const writtenFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const config of configs) {
      const fullPath = path.resolve(this.rootPath, config.path);
      const dirName = path.dirname(fullPath);

      // Ensure parent directory exists recursively (idempotent, eliminates TOCTOU race)
      fs.mkdirSync(dirName, { recursive: true });

      if (this.overwrite) {
        // Overwrite mode: atomic write with 'w' flag
        fs.writeFileSync(fullPath, config.content, { encoding: 'utf-8', flag: 'w' });
        writtenFiles.push(config.path);
      } else {
        // Safe mode: atomic exclusive creation with 'wx' flag (O_CREAT | O_EXCL)
        try {
          fs.writeFileSync(fullPath, config.content, { encoding: 'utf-8', flag: 'wx' });
          writtenFiles.push(config.path);
        } catch (err: any) {
          if (err.code === 'EEXIST') {
            skippedFiles.push(config.path);
          } else {
            throw err;
          }
        }
      }
    }

    return {
      configs,
      writtenFiles,
      skippedFiles,
    };
  }
}

/**
 * Functional convenience wrapper to generate and write configurations
 * @param detection Stack detection result
 * @param options Generator options
 */
export function generateConfigs(detection: StackDetectionResult, options?: ConfigGeneratorOptions): GenerationResult {
  return new ConfigGenerator(options).writeToDisk(detection);
}
