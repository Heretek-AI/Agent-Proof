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
