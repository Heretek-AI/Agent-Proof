/**
 * @file src/generator/templates/biome.ts
 * @description Generates the biome.json configuration for sub-millisecond JS/TS linting and formatting.
 */

/**
 * Generate a standard, high-performance Biome configuration with strict rules against
 * common AI-generated anti-patterns (noExplicitAny, noDebugger, noDoubleEquals, noUnusedImports).
 *
 * @returns Formatted JSON string for biome.json
 */
export function generateBiomeConfig(): string {
  const config = {
    $schema: 'https://biomejs.dev/schemas/1.9.4/schema.json',
    vcs: {
      enabled: true,
      clientKind: 'git',
      useIgnoreFile: true,
      defaultBranch: 'main',
    },
    files: {
      ignoreUnknown: false,
    },
    formatter: {
      enabled: true,
      indentStyle: 'space',
      indentWidth: 2,
      lineWidth: 100,
    },
    linter: {
      enabled: true,
      rules: {
        recommended: true,
        suspicious: {
          noExplicitAny: 'warn',
          noDebugger: 'error',
          noDoubleEquals: 'error',
        },
        correctness: {
          noUnusedVariables: 'error',
          noUnusedImports: 'error',
        },
        style: {
          useConst: 'error',
        },
      },
    },
    javascript: {
      formatter: {
        quoteStyle: 'single',
        semicolons: 'always',
      },
    },
  };

  return JSON.stringify(config, null, 2) + '\n';
}
