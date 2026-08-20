/**
 * @file src/index.ts
 * @description Public API Entrypoint for the @heretek-ai/agent-proof library.
 *
 * Exposes core modules:
 * - Stack detection (StackDetector, detectStack)
 * - Config generation (ConfigGenerator, generateConfigs, individual templates)
 * - Diagnostic streaming & parsers (DiagnosticStreamer, SarifStreamer, formatDiagnostics, parsers)
 * - Diagnostic sanitization & Agentjacking defense (LSPSanitizer, sanitizeDiagnostics)
 * - Transactional write broker & spec freezer (ByteFence, exactReplace)
 * - Cryptographic attestations (ProvenanceEngine, createAttestation)
 * - Failure loop breaker (LoopBreaker)
 * - Git hook installation (HookInstaller, installHooks)
 * - Permission locking (GateLock, lockGovernance, unlockGovernance)
 * - Stage execution runner (GateRunner)
 * - TypeScript type definitions
 */

export * from './types/index.js';
export * from './detector/index.js';
export * from './generator/index.js';
export * from './formatter/index.js';
export * from './sanitizer/index.js';
export * from './broker/index.js';
export * from './attestation/index.js';
export * from './installer/index.js';
export * from './runner/index.js';
export { main } from './cli.js';
