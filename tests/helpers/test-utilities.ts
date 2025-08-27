import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { BN } from "bn.js";
import { PublicKey } from "@solana/web3.js";

/**
 * Assert that two BN values are equal with helpful error messages
 */
export function expectBNEqual(actual: BN, expected: BN | number | string, message?: string): void {
  const expectedBN = new BN(expected);
  expect(actual.toString()).to.equal(expectedBN.toString(), message);
}

/**
 * Assert that a BN value is greater than another
 */
export function expectBNGreaterThan(actual: BN, expected: BN | number | string, message?: string): void {
  const expectedBN = new BN(expected);
  expect(actual.gt(expectedBN)).to.be.true;
}

/**
 * Assert that a BN value is less than another
 */
export function expectBNLessThan(actual: BN, expected: BN | number | string, message?: string): void {
  const expectedBN = new BN(expected);
  expect(actual.lt(expectedBN)).to.be.true;
}

/**
 * Assert that two PublicKey values are equal
 */
export function expectPubkeyEqual(actual: PublicKey, expected: PublicKey, message?: string): void {
  expect(actual.toString()).to.equal(expected.toString(), message);
}

/**
 * Helper to create test data for multiplier account validation
 */
export interface ExpectedMultiplierAccount {
  newMultiplier: number;
  multiplierNonce: number | string | BN;
  newMultiplierNonce: number | string | BN;
  activationTime: number | string | BN;
}

/**
 * Validate multiplier account matches expected values
 */
export function validateMultiplierAccount(
  actual: any,
  expected: ExpectedMultiplierAccount,
  message?: string
): void {
  const prefix = message ? `${message}: ` : "";
  
  expect(actual.newMultiplier).to.equal(expected.newMultiplier, `${prefix}newMultiplier mismatch`);
  expectBNEqual(actual.multiplierNonce, expected.multiplierNonce, `${prefix}multiplierNonce mismatch`);
  expectBNEqual(actual.newMultiplierNonce, expected.newMultiplierNonce, `${prefix}newMultiplierNonce mismatch`);
  expectBNEqual(actual.activationTime, expected.activationTime, `${prefix}activationTime mismatch`);
}

/**
 * Helper to create test scenarios for multiplier updates
 */
export interface MultiplierTestScenario {
  description: string;
  multiplier: number;
  activationTime: number;
  expectedNonce?: number;
  shouldFail?: boolean;
  expectedError?: string;
}

/**
 * Run multiple test scenarios
 */
export async function runMultiplierScenarios(
  scenarios: MultiplierTestScenario[],
  testFunction: (scenario: MultiplierTestScenario) => Promise<void>
): Promise<void> {
  for (const scenario of scenarios) {
    try {
      await testFunction(scenario);
      
      if (scenario.shouldFail) {
        expect.fail(`Scenario "${scenario.description}" should have failed but didn't`);
      }
    } catch (error) {
      if (!scenario.shouldFail) {
        throw new Error(`Scenario "${scenario.description}" failed unexpectedly: ${error}`);
      }
      
      if (scenario.expectedError && !error.toString().includes(scenario.expectedError)) {
        throw new Error(
          `Scenario "${scenario.description}" failed with wrong error. Expected: ${scenario.expectedError}, Got: ${error}`
        );
      }
    }
  }
}

/**
 * Generate test data for boundary value testing
 */
export function generateBoundaryTestValues() {
  return {
    multipliers: {
      valid: [0.0001, 1.0, 100.0, 999999.999999],
      extreme: [0.0, Number.MIN_VALUE, Number.MAX_VALUE],
      invalid: [NaN, Infinity, -Infinity, -1.0],
    },
    nonces: {
      valid: [1, 100, 1000000],
      extreme: [1, new BN(2).pow(new BN(32)), new BN(2).pow(new BN(63)).sub(new BN(1))],
      invalid: [0, -1],
    },
    timestamps: {
      past: [0, 1000000, Date.now() / 1000 - 3600],
      current: [Math.floor(Date.now() / 1000)],
      future: [Math.floor(Date.now() / 1000) + 3600, Math.floor(Date.now() / 1000) + 86400],
      extreme: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    },
  };
}

/**
 * Performance timing utilities
 */
export class PerformanceTimer {
  private startTime: number = 0;
  
  start(): void {
    this.startTime = Date.now();
  }
  
  end(): number {
    return Date.now() - this.startTime;
  }
  
  async timeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.start();
    const result = await fn();
    const duration = this.end();
    return { result, duration };
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  /**
   * Generate unique test multiplier values
   */
  static generateMultipliers(count: number): number[] {
    const multipliers: number[] = [];
    for (let i = 0; i < count; i++) {
      multipliers.push((i + 1) * 10.5 + Math.random() * 5);
    }
    return multipliers;
  }

  /**
   * Generate sequential nonce values
   */
  static generateSequentialNonces(start: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => start + i);
  }

  /**
   * Generate random valid nonce values
   */
  static generateRandomNonces(count: number, min: number = 1, max: number = 1000): number[] {
    return Array.from({ length: count }, () => 
      Math.floor(Math.random() * (max - min + 1)) + min
    );
  }

  /**
   * Generate timestamp sequences
   */
  static generateTimestamps(baseTime: number, intervals: number[], unit: 'seconds' | 'minutes' | 'hours' = 'seconds'): number[] {
    const multiplier = unit === 'seconds' ? 1 : unit === 'minutes' ? 60 : 3600;
    return intervals.map(interval => baseTime + interval * multiplier);
  }
}

/**
 * Account state comparison utilities
 */
export class AccountStateComparator {
  /**
   * Compare two multiplier account states and return differences
   */
  static compareMultiplierAccounts(before: any, after: any): {
    changed: boolean;
    differences: string[];
  } {
    const differences: string[] = [];
    
    if (before.newMultiplier !== after.newMultiplier) {
      differences.push(`newMultiplier: ${before.newMultiplier} -> ${after.newMultiplier}`);
    }
    
    if (before.multiplierNonce.toString() !== after.multiplierNonce.toString()) {
      differences.push(`multiplierNonce: ${before.multiplierNonce} -> ${after.multiplierNonce}`);
    }
    
    if (before.newMultiplierNonce.toString() !== after.newMultiplierNonce.toString()) {
      differences.push(`newMultiplierNonce: ${before.newMultiplierNonce} -> ${after.newMultiplierNonce}`);
    }
    
    if (before.activationTime.toString() !== after.activationTime.toString()) {
      differences.push(`activationTime: ${before.activationTime} -> ${after.activationTime}`);
    }
    
    return {
      changed: differences.length > 0,
      differences,
    };
  }
}

/**
 * Transaction utilities
 */
export class TransactionUtils {
  /**
   * Execute transaction and capture detailed error information
   */
  static async executeWithDetailedError<T>(
    transaction: () => Promise<T>,
    expectedToFail: boolean = false
  ): Promise<{ success: boolean; result?: T; error?: any; errorDetails?: string }> {
    try {
      const result = await transaction();
      return { success: true, result };
    } catch (error) {
      let errorDetails = error.toString();
      
      // Extract more detailed error information from Anchor errors
      if (error.error && error.error.errorMessage) {
        errorDetails = error.error.errorMessage;
      }
      
      if (error.logs) {
        errorDetails += ` | Logs: ${error.logs.join(', ')}`;
      }
      
      return { 
        success: false, 
        error, 
        errorDetails: errorDetails 
      };
    }
  }

  /**
   * Batch execute transactions with error handling
   */
  static async batchExecute<T>(
    transactions: (() => Promise<T>)[],
    stopOnFirstError: boolean = false
  ): Promise<Array<{ success: boolean; result?: T; error?: any; index: number }>> {
    const results: Array<{ success: boolean; result?: T; error?: any; index: number }> = [];
    
    for (let i = 0; i < transactions.length; i++) {
      try {
        const result = await transactions[i]();
        results.push({ success: true, result, index: i });
      } catch (error) {
        results.push({ success: false, error, index: i });
        
        if (stopOnFirstError) {
          break;
        }
      }
    }
    
    return results;
  }
}

/**
 * Load testing utilities
 */
export class LoadTestUtils {
  /**
   * Execute concurrent operations and analyze results
   */
  static async runConcurrentOperations<T>(
    operations: (() => Promise<T>)[],
    maxConcurrency: number = 5
  ): Promise<{
    successful: number;
    failed: number;
    totalDuration: number;
    averageDuration: number;
    results: Array<{ success: boolean; duration: number; result?: T; error?: any }>;
  }> {
    const startTime = Date.now();
    const results: Array<{ success: boolean; duration: number; result?: T; error?: any }> = [];
    
    // Execute operations in batches to control concurrency
    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(async (operation) => {
        const opStartTime = Date.now();
        try {
          const result = await operation();
          return {
            success: true,
            duration: Date.now() - opStartTime,
            result,
          };
        } catch (error) {
          return {
            success: false,
            duration: Date.now() - opStartTime,
            error,
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    const totalDuration = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    return {
      successful,
      failed,
      totalDuration,
      averageDuration,
      results,
    };
  }
}