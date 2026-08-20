/**
 * @file src/index.ts
 * @description Public API Entrypoint for the @heretek-ai/agent-proof library.
 *
 * Exposes core modules:
 * - Stack detection (StackDetector, detectStack)
 * - Config generation (ConfigGenerator, generateConfigs, individual templates)
 * - Diagnostic streaming & parsers (DiagnosticStreamer, formatDiagnostics, individual parsers)
 * - Git hook installation (HookInstaller, installHooks)
 * - Permission locking (GateLock, lockGovernance, unlockGovernance)
 * - Stage execution runner (GateRunner)
 * - TypeScript type definitions
 */

export * from './types/index.js';
export * from './detector/index.js';
export * from './generator/index.js';
export * from './formatter/index.js';
export * from './installer/index.js';
export * from './runner/index.js';
export { main } from './cli.js';
