/**
 * @file src/generator/templates/aislop.ts
 * @description Generates the .aislop/config.yml configuration for deterministic AI slop detection.
 *
 * Enforces zero-tolerance rules for AI code smells:
 * - Swallowed errors and empty catch blocks
 * - Unsafe type casts (as any)
 * - Hallucinated imports
 * - Insecure YAML deserialization (yaml.load without SafeLoader)
 * - Deprecated process execution (os.popen)
 * - Production panic macros (todo!() in Rust)
 */

/**
 * Generate an AISlop configuration defining deterministic rules against
 * swallowed errors, empty catch blocks, hallucinated imports, and unsafe patterns.
 *
 * @returns Formatted YAML string for .aislop/config.yml
 */
export function generateAislopConfig(): string {
  return `# AISlop Configuration for Deterministic AI Code Smell & Slop Detection
version: "1.0"
fail_threshold: 50

rules:
  # Swallowed errors & silent exceptions
  swallowed_errors:
    severity: error
    fail_score: 30
    enabled: true

  # Empty catch blocks
  empty_catch_blocks:
    severity: error
    fail_score: 25
    enabled: true

  # Hallucinated or non-existent imports
  hallucinated_imports:
    severity: error
    fail_score: 40
    enabled: true

  # Insecure YAML loading without SafeLoader
  unsafe_yaml_load:
    severity: error
    fail_score: 35
    enabled: true

  # Deprecated process execution (e.g. os.popen)
  deprecated_process_spawn:
    severity: warning
    fail_score: 20
    enabled: true

  # Production runtime panic macros (e.g. todo!() in Rust)
  production_panic_macros:
    severity: error
    fail_score: 50
    enabled: true

  # Dead code / unused functions created by LLMs
  dead_code:
    severity: warning
    fail_score: 15
    enabled: true

  # Unsafe type casts (e.g. as any, Any casts)
  unsafe_casts:
    severity: warning
    fail_score: 15
    enabled: true

  # Missing error boundaries in async operations
  unhandled_async_rejections:
    severity: error
    fail_score: 25
    enabled: true

ignore:
  - "node_modules/**"
  - "dist/**"
  - "build/**"
  - "**/*.test.*"
  - "**/*.spec.*"
`;
}
