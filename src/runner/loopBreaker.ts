/**
 * @file src/runner/loopBreaker.ts
 * @description Failure Loop Breaker & Context Window Protection Engine.
 *
 * Tracks defect repetition across consecutive agent self-correction iterations.
 * If the exact same violation signature persists across $\ge 3$ iterations without
 * resolution, trips a hard halt to prevent context exhaustion and token budget spikes.
 */

import type { DiagnosticItem, LoopBreakerState } from '../types/index.js';

/** Default max consecutive identical failures before tripping */
export const DEFAULT_LOOP_THRESHOLD = 3;

/**
 * Failure Loop Breaker & Token Thrashing Protector.
 */
export class LoopBreaker {
  private readonly maxThreshold: number;
  private state: LoopBreakerState;

  /**
   * Initialize LoopBreaker
   * @param maxThreshold Consecutive repetition threshold (defaults to 3)
   */
  constructor(maxThreshold: number = DEFAULT_LOOP_THRESHOLD) {
    this.maxThreshold = maxThreshold;
    this.state = {
      consecutiveIdenticalCount: 0,
      history: [],
      tripped: false,
    };
  }

  /**
   * Compute a deterministic signature representing the set of active violations.
   *
   * @param diagnostics Array of DiagnosticItem findings
   * @returns Signature string
   */
  public static computeSignature(diagnostics: DiagnosticItem[]): string {
    if (diagnostics.length === 0) return 'CLEAN';

    const sigs = diagnostics.map((d) => `${d.source}:${d.rule_id}:${d.file_path}`);
    sigs.sort();
    return sigs.join('|');
  }

  /**
   * Record a new diagnostic iteration and evaluate loop repetition status.
   *
   * @param diagnostics Active diagnostic findings from the current execution
   * @returns Current LoopBreakerState
   */
  public recordIteration(diagnostics: DiagnosticItem[]): LoopBreakerState {
    const sig = LoopBreaker.computeSignature(diagnostics);
    this.state.history.push(sig);

    if (sig === 'CLEAN') {
      this.state.consecutiveIdenticalCount = 0;
      this.state.lastSignature = sig;
      this.state.tripped = false;
      return { ...this.state };
    }

    if (this.state.lastSignature === sig) {
      this.state.consecutiveIdenticalCount += 1;
    } else {
      this.state.consecutiveIdenticalCount = 1;
      this.state.lastSignature = sig;
    }

    if (this.state.consecutiveIdenticalCount >= this.maxThreshold) {
      this.state.tripped = true;
    }

    return { ...this.state };
  }

  /**
   * Check if the failure loop tripwire has been activated.
   */
  public isTripped(): boolean {
    return this.state.tripped;
  }

  /**
   * Get current state
   */
  public getState(): LoopBreakerState {
    return { ...this.state };
  }

  /**
   * Reset breaker state
   */
  public reset(): void {
    this.state = {
      consecutiveIdenticalCount: 0,
      history: [],
      tripped: false,
    };
  }

  /**
   * Generate an LSP diagnostic item signaling a failure loop halt.
   */
  public generateHaltDiagnostic(): DiagnosticItem {
    return {
      source: 'loopbreaker',
      rule_id: 'FAILURE_LOOP_TRIPPED',
      severity: 'ERROR',
      file_path: 'workspace',
      error_message: `Failure loop tripped: Identical defect signature repeated ${this.state.consecutiveIdenticalCount} consecutive times. Execution halted to prevent context exhaustion and token burning.`,
      repair_instruction: {
        action: 'MANUAL_FIX',
        description: 'Pause autonomous edits and request human developer clarification or re-examine architecture assumptions.',
        repair_tokens: ['# Human developer intervention required to resolve repeated failure loop'],
      },
    };
  }
}
