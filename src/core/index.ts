/**
 * src/core/ - Pure TypeScript Resilience Domain Logic
 * 
 * STRICT CONTRACT:
 * - ZERO React imports allowed (no JSX, no hooks, no React dependencies).
 * - 100% deterministic, framework-agnostic, and unit-testable.
 */

export interface CircuitBreakerConfig {
  failureThresholdPercentage: number;
  recoveryTimeMs: number;
  halfOpenRequestLimit: number;
  slidingWindowSize: number;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface LatencyProfile {
  minLatencyMs: number;
  maxLatencyMs: number;
  jitterPercentage: number;
}

export interface IdempotencyRecord<T = unknown> {
  key: string;
  createdAt: number;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  response?: T;
}
