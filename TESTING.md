# Testing Guide for Solana Multiplier Updater

This document describes the comprehensive testing suite implemented for the Solana Multiplier Updater program.

## Overview

The testing suite provides comprehensive coverage across multiple dimensions:

- **Unit Tests**: Rust-based tests for individual components and utilities
- **Integration Tests**: TypeScript-based tests for full instruction workflows
- **Security Tests**: Authorization, PDA validation, and access control
- **Performance Tests**: Load testing and concurrent operation validation
- **Edge Case Tests**: Boundary conditions and error scenarios

## Test Structure

### Rust Unit Tests (`programs/backed-solana-tokens/src/tests/`)

- `test_multiplier_utils.rs` - Tests for utility functions and nonce logic
- `test_state.rs` - Tests for account state structures and serialization

### TypeScript Integration Tests (`tests/`)

#### Core Functionality Tests
- `initialize.test.ts` - Program initialization and setup
- `initialize-token.test.ts` - Token account creation and validation
- `update-multiplier.test.ts` - Multiplier update operations and nonce progression

#### Specialized Test Suites
- `error-cases.test.ts` - Error conditions and invalid input handling
- `security-authorization.test.ts` - Security, authorization, and PDA validation
- `timing-nonce-validation.test.ts` - Time-based logic and nonce validation

#### Test Utilities and Helpers
- `helpers/test-setup.ts` - Common setup utilities and test fixtures
- `helpers/test-utilities.ts` - Advanced testing utilities and data generators
- `helpers/create-test-token.ts` - Token creation utilities with ScaledUI extension

#### Comprehensive Test Runner
- `run-all-tests.ts` - Complete end-to-end test scenarios and performance validation

## Running Tests

### Prerequisites

Ensure you have the necessary dependencies installed:

```bash
# Install dependencies
yarn install

# Build the program
anchor build
```

### Running Individual Test Suites

```bash
# Run all tests
anchor test

# Run specific test files
yarn test tests/initialize.test.ts
yarn test tests/update-multiplier.test.ts
yarn test tests/error-cases.test.ts
yarn test tests/security-authorization.test.ts
yarn test tests/timing-nonce-validation.test.ts

# Run the comprehensive test runner
yarn test tests/run-all-tests.ts
```

### Running Rust Unit Tests

```bash
# Run Rust tests (from the program directory)
cd programs/backed-solana-tokens
cargo test

# Run with output
cargo test -- --nocapture
```

## Test Coverage Areas

### 1. Program Initialization
- Program data account creation and ownership
- Multiple initialization attempts (should fail)
- PDA derivation validation
- Authorization checks

### 2. Token Account Management
- Multiplier account creation for specific mints
- Cross-mint account isolation
- Account space allocation validation
- Ownership constraint enforcement

### 3. Multiplier Updates
- Auto-increment nonce progression
- Custom nonce validation
- Multiplier value handling (including edge cases)
- Activation time logic

### 4. Nonce Logic and Validation
- Sequential nonce progression
- Invalid nonce rejection (≤ current nonce)
- Mixed auto-increment and custom nonce operations
- Nonce consistency across operations

### 5. Timing and Activation Logic
- Past timestamp handling (immediate activation)
- Future timestamp handling (delayed activation)
- Time-based state transitions
- Edge cases around current time

### 6. Security and Authorization
- Program ownership validation
- Signer verification
- PDA security and validation
- Cross-program invocation (CPI) security
- Account state integrity
- Reentrancy prevention

### 7. Error Handling
- Invalid multiplier nonce errors
- Account not initialized errors
- Authorization failures
- Account mismatch scenarios
- Numerical edge cases
- System-level errors

### 8. Performance and Load Testing
- Concurrent operation handling
- Resource exhaustion protection
- Large value processing
- Multiple token management

## Test Data and Scenarios

### Boundary Value Testing
The test suite includes comprehensive boundary value testing for:
- **Multiplier values**: 0.0001 to 999999.999999, including zero and extreme values
- **Nonce values**: 1 to u64::MAX, including sequential and random values
- **Timestamps**: Past, present, future, and extreme values

### Error Scenario Testing
Systematic testing of error conditions:
- Invalid nonce values
- Unauthorized access attempts
- Incorrect account configurations
- Malformed transaction data
- Resource limitations

### Performance Scenarios
- Multiple concurrent updates
- High-frequency operations
- Large-scale token management
- Extended operation sequences

## Test Utilities and Helpers

### Setup Utilities
- `setupTest()` - Create complete test environment
- `initializeProgram()` - Initialize program with owner
- `initializeTokenAccount()` - Create token multiplier account

### Validation Utilities
- `validateMultiplierAccount()` - Compare account state with expected values
- `expectBNEqual()` - BN value comparison with helpful error messages
- PDA derivation validation
- Account state comparison utilities

### Data Generation
- `TestDataGenerator` - Generate test data for various scenarios
- Boundary value generators
- Random test data creation
- Timestamp sequence generation

### Performance Testing
- `PerformanceTimer` - Execution timing utilities
- `LoadTestUtils` - Concurrent operation testing
- Resource usage monitoring
- Transaction batching utilities

## Test Configuration

### Local Testing
The tests are configured to run against a local validator with the following cloned accounts:
- Token Metadata program
- Token program
- Token 2022 program
- Associated Token program

### Test Environment Variables
Configure the test environment in `Anchor.toml`:
- Cluster: Localnet
- Wallet: `~/.config/solana/id.json`
- Test timeout: 1,000,000ms

## Continuous Integration

The testing suite is designed for CI/CD integration:
- All tests are deterministic and repeatable
- No external dependencies required
- Comprehensive error reporting
- Performance benchmarking included

## Test Maintenance

### Adding New Tests
1. Follow existing test structure patterns
2. Use provided test utilities and helpers
3. Include both positive and negative test cases
4. Add appropriate error handling validation
5. Document test scenarios and expected outcomes

### Test Data Management
- Use test data generators for consistent data
- Include boundary value testing for new features
- Maintain test data isolation between tests
- Clean up test artifacts appropriately

## Common Issues and Troubleshooting

### Test Failures
- Ensure local validator is running with correct accounts
- Verify test timeout settings for complex operations
- Check account initialization order
- Validate PDA derivations

### Performance Issues
- Adjust concurrency limits for load tests
- Monitor resource usage during testing
- Use appropriate test timeouts
- Consider test parallelization limits

### Environment Issues
- Verify Solana CLI configuration
- Check wallet keypair availability
- Ensure sufficient SOL for test operations
- Validate program deployment

## Metrics and Reporting

The test suite provides detailed metrics:
- Test execution times
- Success/failure rates for load tests
- Account state validation results
- Performance benchmarks
- Error categorization and frequency

This comprehensive testing approach ensures the reliability, security, and performance of the Solana Multiplier Updater program across all operational scenarios.