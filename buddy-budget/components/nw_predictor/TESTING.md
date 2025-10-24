# Net Worth Predictor - Testing Documentation

## Overview

The Net Worth Predictor module uses comprehensive Jest-based testing to ensure accuracy and reliability of Monte Carlo simulations and financial calculations.

## Test File Location

- **Test File**: `components/nw_predictor/nw_prediction.test.js`
- **Source File**: `components/nw_predictor/nw_prediction.js`

## Running Tests

### Local Development

```bash
# Run all tests
bun test

# Run tests in watch mode (great for development)
bun run test:watch

# Run tests with coverage report
bun run test:coverage
```

### Continuous Integration

Tests automatically run on:
- Every push to `main` or `develop` branches
- Every pull request targeting `main` or `develop`
- Multiple Node.js versions (18.x, 20.x, 22.x)

## Test Structure

The test suite is organized into 9 comprehensive test categories:

### 1. Basic Calculation Accuracy (Zero Volatility)

Tests deterministic behavior when volatility is set to 0:

- **Monthly Growth Calculation** - Verifies correct compound growth rate application
- **Initial Values Preservation** - Ensures first month matches input parameters
- **Monthly Contributions** - Validates contribution tracking and accumulation
- **Data Point Generation** - Confirms correct number of months (years × 12)
- **Date Incrementation** - Verifies month-by-month date progression

### 2. Growth Rate Calculations

Tests various growth rate scenarios:

- **Zero Growth** - No growth, values should remain stable
- **Negative Growth** - Declining values over time
- **Annual to Monthly Conversion** - Validates compound interest formula accuracy

**Key Formula**: `monthlyGrowthRate = (1 + annualRate) ^ (1/12)`

### 3. Inflation Adjustment

Tests purchasing power calculations:

- **Inflation Application** - Verifies inflation compounds correctly
- **Zero Inflation Handling** - Nominal = real values when inflation is 0%

**Key Formula**: `realValue = nominalValue / (1 + inflation) ^ months`

### 4. Statistics & Scenarios

Tests Monte Carlo simulation outputs:

- **Scenario Ordering** - Pessimistic < Realistic < Optimistic
- **Percentile Calculations** - 10th, 50th (median), 90th percentiles
- **Probability Bounds** - All probabilities between 0 and 1
- **Mean Calculation** - Statistical average of all simulations
- **Single Simulation Handling** - Edge case where all scenarios are identical

### 5. Monte Carlo Simulation

Tests randomness and volatility:

- **Different Results with Volatility** - Ensures randomness produces variation
- **Volatility Impact** - Higher volatility = wider outcome range

**Key Concept**: Uses Box-Muller Transform for normally-distributed returns

### 6. Data Integrity

Validates internal consistency:

- **Liquidity Constancy** - Liquidity doesn't change (no withdrawals modeled)
- **Total Invested Tracking** - Cumulative contributions tracked correctly
- **Total Calculation** - `total = liquidity + investments`
- **Inflation-Adjusted Total** - Sum of inflation-adjusted components

### 7. Edge Cases

Tests boundary conditions and extreme inputs:

- **Zero Initial Values** - Starting from nothing
- **Zero Monthly Contributions** - Investment growth only
- **Single Year Timeframe** - Minimum projection period
- **Large Time Horizons** - 30+ year projections
- **Extreme Volatility** - High volatility (50%+) handling
- **Very Low Volatility** - Near-deterministic behavior

### 8. Return Structure

Validates API contract:

- **Object Structure** - Ensures all expected fields exist
- **Monthly Data Structure** - Each month has required properties
- **Data Types** - Correct types (numbers, Dates, objects)

**Expected Return Format**:
```javascript
{
  scenarios: {
    pessimistic: [...],  // 10th percentile outcome
    realistic: [...],    // 50th percentile (median)
    optimistic: [...]    // 90th percentile outcome
  },
  finalValues: {
    min, max, median, mean,
    percentile10, percentile90
  },
  probabilityAnalysis: {
    chanceOfLoss,
    chanceOfDoubling
  }
}
```

### 9. Probability Analysis

Tests statistical probability calculations:

- **Chance of Loss** - Probability of ending below initial investment
- **Chance of Doubling** - Probability of 2x return
- **Expected Return Impact** - Higher growth = better probabilities

## Key Test Patterns

### Deterministic Tests (volatility = 0)

Used for exact mathematical verification:

```javascript
const result = predictNetWorth(
  10000,    // initialLiquidity
  50000,    // initialInvestments
  0.07,     // 7% annual growth
  1,        // 1 year
  0,        // no monthly contributions
  0,        // no inflation
  0,        // zero volatility (deterministic)
  1         // single simulation
);
```

### Stochastic Tests (volatility > 0)

Used for statistical behavior verification:

```javascript
const result = predictNetWorth(
  10000,
  50000,
  0.07,
  5,
  1000,
  0.02,
  0.15,     // 15% volatility
  1000      // many simulations for statistical validity
);
```

## Coverage Goals

### Current Coverage

Run `bun run test:coverage` to see detailed coverage report.

### Target Coverage

- **Statements**: > 95%
- **Branches**: > 90%
- **Functions**: 100%
- **Lines**: > 95%

## Mathematical Accuracy

### Tolerance Levels

Tests use appropriate tolerance for floating-point comparisons:

- **Tight tolerance** (`toBeCloseTo(value, 5)`): For simple calculations
- **Moderate tolerance** (`toBeCloseTo(value, -1)`): For compound growth
- **Loose tolerance** (`toBeCloseTo(value, -2)`): For complex simulations

### Why Tolerances Matter

JavaScript uses IEEE 754 floating-point arithmetic, which can introduce tiny rounding errors. Tests account for this while ensuring mathematical correctness.

## Adding New Tests

### Test Naming Convention

Follow the existing pattern:

```javascript
describe('Feature Category', () => {
  test('should do specific thing when condition', () => {
    // Arrange
    const inputs = {...};

    // Act
    const result = predictNetWorth(...);

    // Assert
    expect(result.something).toBe(expected);
  });
});
```

### Best Practices

1. **One assertion per test** (when possible)
2. **Clear test names** - Describe what and why
3. **Deterministic first** - Test math with volatility=0
4. **Edge cases matter** - Test boundaries and extremes
5. **Document complex tests** - Explain non-obvious expectations

## Known Limitations

### Off-by-One Month

The simulation loop runs from `i=1` to `i<years*12`, meaning:
- Initial month (index 0) is the starting point
- 11 months of growth for a 1-year projection
- This is intentional and tested

### Random Number Determinism

Tests that verify different outcomes with volatility mock `Math.random()` to ensure reproducible test behavior.

## Troubleshooting

### Test Failures

**"Expected X to be close to Y"**
- Check if tolerance is appropriate
- Verify the expected value calculation
- Ensure formula matches implementation

**"Scenario ordering validation failed"**
- Increase number of simulations
- Check if volatility is too low
- Verify percentile calculation logic

**"Date tests failing"**
- Timezone issues - tests use local timezone
- Ensure Date objects are compared correctly

### Running Specific Tests

```bash
# Run only Net Worth Predictor tests
bun test nw_prediction.test.js

# Run a specific test suite
bun test -t "Growth Rate Calculations"

# Run a specific test
bun test -t "should handle zero growth rate"
```

## Continuous Integration

### GitHub Actions Workflow

See [.github/workflows/ci.yml](/.github/workflows/ci.yml) for full CI configuration.

**Workflow includes**:
- Automated testing on push/PR
- Multi-version Node.js testing
- Code coverage reporting
- Build verification
- Artifact archiving

### Coverage Reports

Coverage reports are:
- Generated on every CI run
- Uploaded to Codecov (if configured)
- Available as GitHub Actions artifacts
- Retained for 7 days

## Related Documentation

- [Net Worth Predictor Explained](./NET_WORTH_PREDICTOR_EXPLAINED.md) - Algorithm deep-dive
- [Main README](/README.md) - Project overview
- [Contributing Guidelines](/CONTRIBUTING.md) - Development workflow

## Questions or Issues?

If you encounter testing issues or have questions:

1. Check existing test patterns for similar cases
2. Review the [Jest documentation](https://jestjs.io/docs/getting-started)
3. Open an issue on GitHub with the `testing` label
4. Ask in GitHub Discussions

---

**Last Updated**: 2025-10-24
**Test Framework**: Jest 30.2.0
**Test Environment**: jsdom (simulated browser)
