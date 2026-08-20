import { describe, it, expect } from 'vitest';
import { LoopBreaker } from '../src/runner/loopBreaker';
import type { DiagnosticItem } from '../src/types';

describe('LoopBreaker — Failure Loop Breaker & Context Window Protection', () => {
  it('tracks defect repetitions and trips when threshold is reached', () => {
    const breaker = new LoopBreaker(3);
    const defect: DiagnosticItem = {
      source: 'aislop',
      rule_id: 'AI_SLOP_SWALLOWED_ERROR',
      severity: 'ERROR',
      file_path: 'src/auth.ts',
      error_message: 'Empty catch block',
    };

    // Iteration 1
    const s1 = breaker.recordIteration([defect]);
    expect(s1.consecutiveIdenticalCount).toBe(1);
    expect(s1.tripped).toBe(false);

    // Iteration 2
    const s2 = breaker.recordIteration([defect]);
    expect(s2.consecutiveIdenticalCount).toBe(2);
    expect(s2.tripped).toBe(false);

    // Iteration 3: Trip threshold reached
    const s3 = breaker.recordIteration([defect]);
    expect(s3.consecutiveIdenticalCount).toBe(3);
    expect(s3.tripped).toBe(true);
    expect(breaker.isTripped()).toBe(true);

    const haltDiag = breaker.generateHaltDiagnostic();
    expect(haltDiag.rule_id).toBe('FAILURE_LOOP_TRIPPED');
    expect(haltDiag.error_message).toContain('repeated 3 consecutive times');
  });

  it('resets repetition count on clean execution', () => {
    const breaker = new LoopBreaker(3);
    const defect: DiagnosticItem = {
      source: 'biome',
      rule_id: 'noExplicitAny',
      severity: 'ERROR',
      file_path: 'src/index.ts',
      error_message: 'any found',
    };

    breaker.recordIteration([defect]);
    breaker.recordIteration([defect]);
    expect(breaker.getState().consecutiveIdenticalCount).toBe(2);

    // Resolved in iteration 3
    breaker.recordIteration([]);
    expect(breaker.getState().consecutiveIdenticalCount).toBe(0);
    expect(breaker.isTripped()).toBe(false);
  });
});
