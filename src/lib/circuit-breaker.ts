import { logger } from "@/lib/logger";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  /** Number of consecutive failures to trip the circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting recovery */
  resetTimeoutMs: number;
  /** Name for logging */
  name: string;
}

/**
 * Simple circuit breaker that prevents cascading failures when
 * an external service is down. Tracks consecutive failures and
 * short-circuits requests when the threshold is exceeded.
 */
export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws immediately if the circuit is OPEN and reset timeout hasn't elapsed.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.options.resetTimeoutMs) {
        throw new CircuitBreakerOpenError(
          `Circuit breaker "${this.options.name}" is OPEN — ` +
          `retry in ${Math.ceil((this.options.resetTimeoutMs - elapsed) / 1000)}s`
        );
      }
      // Transition to HALF_OPEN: allow one probe request
      this.state = "HALF_OPEN";
      logger.info(`Circuit breaker "${this.options.name}" transitioning to HALF_OPEN`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN" || this.failures > 0) {
      logger.info(`Circuit breaker "${this.options.name}" recovered → CLOSED`);
    }
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = "OPEN";
      logger.warn(
        `Circuit breaker "${this.options.name}" tripped → OPEN after ${this.failures} failures`
      );
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}
