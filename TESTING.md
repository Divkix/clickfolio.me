# Testing Guide

This document describes the testing strategy for Clickfolio, including how to run tests, coverage targets, and best practices.

## Test Structure

Tests are organized into three categories based on the [Trophy Testing methodology](https://kentcdodds.com/blog/write-tests):

- **`__tests__/unit/`** — Pure function tests, utilities, and isolated logic (fast, no external dependencies)
- **`__tests__/integration/`** — API routes, service interactions, database operations, and queue processing
- **`__tests__/security/`** — Security-specific tests (authorization, IDOR protection, rate limiting, input sanitization)

## Running Tests

### All Tests
```bash
bun run test
```

### Individual Test Suites
```bash
# Unit tests only (fastest, no retries)
bun run test:unit

# Integration tests only (may have timing issues, 2 retries)
bun run test:integration

# Security tests only (forks for isolation, no retries)
bun run test:security
```

### With Coverage
```bash
# All tests with coverage report
bun run test:coverage

# CI mode (JSON reporter)
bun run test:ci
```

### Development Mode
```bash
# Watch mode - re-runs tests on file changes
bun run test:watch

# UI mode - interactive test explorer (requires @vitest/ui package)
bun run test:ui
```

## Coverage Thresholds

Coverage is enforced in CI via threshold settings in `vitest.config.ts`:

| Metric      | Threshold |
|-------------|-----------|
| Statements  | 30%       |
| Branches    | 30%       |
| Functions   | 25%       |
| Lines       | 30%       |

**Note:** Coverage thresholds are enforced in CI. If coverage falls below these thresholds, the build will fail.

## Configuration Files

- **`vitest.config.ts`** — Main configuration for all tests
- **`vitest.unit.config.ts`** — Unit test specific config (isolation, no retries)
- **`vitest.integration.config.ts`** — Integration test config (retries, longer timeout)
- **`vitest.security.config.ts`** — Security test config (forks pool, strict timeouts)

## Writing Tests

### Test File Naming
- Unit tests: `__tests__/unit/**/*.test.ts`
- Integration tests: `__tests__/integration/**/*.test.ts`
- Security tests: `__tests__/security/**/*.test.ts`

### Mocking Patterns

See `__tests__/setup/mocks/` for examples of common mocking patterns:
- Database operations via Drizzle
- Cloudflare Workers bindings
- Better Auth sessions
- External API calls

### Best Practices

1. **Use descriptive test names**: `describe` the function/component, `it` should read like a sentence
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification phases
3. **One assertion per test** (generally): Tests should verify one concept
4. **Mock at boundaries**: Mock external services (DB, APIs), not internal functions
5. **Use realistic fixtures**: Prefer real data shapes over minimal mocks

### Example Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { someFunction } from "@/lib/utils";

describe("someFunction", () => {
  it("should return expected result for valid input", () => {
    // Arrange
    const input = { id: "123", name: "Test" };
    
    // Act
    const result = someFunction(input);
    
    // Assert
    expect(result).toEqual({ success: true, data: input });
  });
  
  it("should throw error for invalid input", () => {
    expect(() => someFunction(null)).toThrow("Invalid input");
  });
});
```

## CI/CD Integration

Tests run automatically on every push and pull request via GitHub Actions:

1. **Unit Tests** — Run first, fastest feedback
2. **Integration Tests** — Run in parallel with unit tests
3. **Security Tests** — Run in parallel with other tests
4. **Coverage Report** — Uploaded as artifacts and commented on PRs

### Coverage Reports

After each CI run, coverage reports are:
- Uploaded as artifacts (accessible from the Actions tab)
- Commented on pull requests (via lcov-reporter-action)
- Used to generate coverage badges on the main branch

### Required Checks

All test jobs must pass before merging:
- `unit-tests`
- `integration-tests`
- `security-tests`

## Troubleshooting

### Tests Fail Locally But Pass in CI
- Check for environment-specific differences (case sensitivity on macOS vs Linux)
- Ensure all mocks are properly reset between tests
- Check for race conditions in async tests

### Flaky Tests
- Integration tests have 2 retries configured
- If tests are consistently flaky, consider:
  - Increasing timeout
  - Better isolation between tests
  - Fixing the underlying race condition

### Coverage Not Generated
- Ensure `@vitest/coverage-v8` is installed
- Check that source files are included in the `coverage.include` pattern
- Verify tests are actually running (not just passing with 0 tests)

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Trophy Testing](https://kentcdodds.com/blog/write-tests)
