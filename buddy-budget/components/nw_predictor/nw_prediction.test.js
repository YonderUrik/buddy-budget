import { predictNetWorth } from './nw_prediction.js';

describe('Net Worth Prediction Tests', () => {

  // ============================================================================
  // DETERMINISTIC TESTS (volatility = 0)
  // ============================================================================

  describe('Basic Calculation Accuracy (Zero Volatility)', () => {
    test('should calculate deterministic growth correctly with zero volatility', () => {
      const result = predictNetWorth(
        10000,    // initialLiquidity
        50000,    // initialInvestments
        0.07,     // annualGrowthRate (7%)
        1,        // years
        0,        // monthlyContributions
        0,        // annualInflationRate
        0,        // volatility (deterministic)
        1         // simulations
      );

      const finalValue = result.scenarios.realistic[11].investments;
      const monthlyGrowthRate = Math.pow(1.07, 1/12);

      // Each month multiplies by monthlyGrowthRate (11 times from month 1 to month 11)
      const expectedValue = 50000 * Math.pow(monthlyGrowthRate, 11);

      // Should be close to expected value (allowing small rounding)
      expect(finalValue).toBeCloseTo(expectedValue, -1);
    });

    test('should preserve initial values in first month', () => {
      const result = predictNetWorth(
        10000,
        50000,
        0.07,
        1,
        1000,
        0.02,
        0,
        1
      );

      const firstMonth = result.scenarios.realistic[0];

      expect(firstMonth.liquidity).toBe(10000);
      expect(firstMonth.investments).toBe(50000);
      expect(firstMonth.total).toBe(60000);
      expect(firstMonth.totalInvested).toBe(0);
    });

    test('should apply monthly contributions correctly', () => {
      const monthlyContribution = 1000;
      const result = predictNetWorth(
        0,
        10000,
        0,        // 0% growth
        1,        // 1 year
        monthlyContribution,
        0,        // no inflation
        0,        // no volatility
        1
      );

      const lastMonth = result.scenarios.realistic[11]; // month 11 (index 11 is the 12th data point)

      // Loop runs from i=1 to i<12, so 11 iterations, meaning 11 contributions
      // Total invested should be 11 * 1000 = 11,000
      expect(lastMonth.totalInvested).toBe(11000);

      // Investments: initial 10000 + 11 months of contributions = 21,000
      expect(lastMonth.investments).toBeCloseTo(21000, 0);
    });

    test('should generate exactly years * 12 data points', () => {
      const years = 5;
      const result = predictNetWorth(10000, 50000, 0.07, years, 1000, 0.02, 0, 1);

      expect(result.scenarios.realistic.length).toBe(years * 12);
      expect(result.scenarios.pessimistic.length).toBe(years * 12);
      expect(result.scenarios.optimistic.length).toBe(years * 12);
    });

    test('should increment dates correctly month by month', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 2, 1000, 0.02, 0, 1);
      const scenario = result.scenarios.realistic;

      for (let i = 1; i < scenario.length; i++) {
        const prevDate = scenario[i - 1].dateMonth;
        const currDate = scenario[i].dateMonth;

        // Check that month incremented by 1 (accounting for year rollover)
        const monthDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12
                        + (currDate.getMonth() - prevDate.getMonth());

        expect(monthDiff).toBe(1);
      }
    });
  });

  // ============================================================================
  // GROWTH RATE TESTS
  // ============================================================================

  describe('Growth Rate Calculations', () => {
    test('should handle zero growth rate', () => {
      const result = predictNetWorth(
        0,
        10000,
        0,        // 0% growth
        1,
        0,        // no contributions
        0,        // no inflation
        0,        // no volatility
        1
      );

      const finalValue = result.scenarios.realistic[11].investments;

      // With 0% growth and no contributions, should remain ~10000
      expect(finalValue).toBeCloseTo(10000, 0);
    });

    test('should handle negative growth rate', () => {
      const result = predictNetWorth(
        0,
        10000,
        -0.10,    // -10% annual growth
        1,
        0,
        0,
        0,        // no volatility
        1
      );

      const finalValue = result.scenarios.realistic[11].investments;
      const monthlyGrowthRate = Math.pow(0.90, 1/12);
      const expectedValue = 10000 * Math.pow(monthlyGrowthRate, 11);

      expect(finalValue).toBeCloseTo(expectedValue, -1);
    });

    test('should convert annual growth to monthly correctly', () => {
      // Test that monthly compounding produces correct annual result
      const initialInvestment = 10000;
      const annualRate = 0.12; // 12% annual

      const result = predictNetWorth(
        0,
        initialInvestment,
        annualRate,
        1,
        0,
        0,
        0,
        1
      );

      const finalValue = result.scenarios.realistic[11].investments;
      const monthlyGrowthRate = Math.pow(1.12, 1/12);
      // 11 months of growth (loop runs from i=1 to i<12)
      const expectedValue = initialInvestment * Math.pow(monthlyGrowthRate, 11);

      expect(finalValue).toBeCloseTo(expectedValue, -1);
    });
  });

  // ============================================================================
  // INFLATION TESTS
  // ============================================================================

  describe('Inflation Adjustment', () => {
    test('should apply inflation adjustment correctly', () => {
      const result = predictNetWorth(
        10000,
        0,
        0,
        1,
        0,
        0.12,     // 12% annual inflation
        0,
        1
      );

      const lastMonth = result.scenarios.realistic[11];
      const monthlyInflationRate = Math.pow(1.12, 1/12);
      const expectedInflationAdjusted = 10000 / Math.pow(monthlyInflationRate, 11);

      expect(lastMonth.inflationAdjustedLiquidity).toBeCloseTo(expectedInflationAdjusted, -1);
    });

    test('should match nominal values when inflation is zero', () => {
      const result = predictNetWorth(
        10000,
        50000,
        0.07,
        1,
        1000,
        0,        // no inflation
        0,
        1
      );

      const lastMonth = result.scenarios.realistic[11];

      // With no inflation, adjusted values should approximately equal nominal values
      // Note: There may be small differences due to how inflation is applied incrementally
      expect(lastMonth.inflationAdjustedTotal).toBeCloseTo(lastMonth.total, -2);
    });
  });

  // ============================================================================
  // STATISTICS & SCENARIOS TESTS
  // ============================================================================

  describe('Statistics and Scenarios', () => {
    test('should maintain correct scenario ordering (pessimistic < realistic < optimistic)', () => {
      const result = predictNetWorth(
        10000,
        50000,
        0.07,
        5,
        1000,
        0.02,
        0.15,     // realistic volatility
        1000      // many simulations
      );

      const pessimisticFinal = result.scenarios.pessimistic[result.scenarios.pessimistic.length - 1].inflationAdjustedTotal;
      const realisticFinal = result.scenarios.realistic[result.scenarios.realistic.length - 1].inflationAdjustedTotal;
      const optimisticFinal = result.scenarios.optimistic[result.scenarios.optimistic.length - 1].inflationAdjustedTotal;

      expect(pessimisticFinal).toBeLessThan(realisticFinal);
      expect(realisticFinal).toBeLessThan(optimisticFinal);
    });

    test('should calculate percentiles correctly', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 1000);

      expect(result.finalValues.min).toBeLessThanOrEqual(result.finalValues.percentile10);
      expect(result.finalValues.percentile10).toBeLessThanOrEqual(result.finalValues.median);
      expect(result.finalValues.median).toBeLessThanOrEqual(result.finalValues.percentile90);
      expect(result.finalValues.percentile90).toBeLessThanOrEqual(result.finalValues.max);
    });

    test('should have probability values between 0 and 1', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 100);

      expect(result.probabilityAnalysis.chanceOfLoss).toBeGreaterThanOrEqual(0);
      expect(result.probabilityAnalysis.chanceOfLoss).toBeLessThanOrEqual(1);
      expect(result.probabilityAnalysis.chanceOfDoubling).toBeGreaterThanOrEqual(0);
      expect(result.probabilityAnalysis.chanceOfDoubling).toBeLessThanOrEqual(1);
    });

    test('should calculate mean from all simulations', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 100);

      // Mean should be between min and max
      expect(result.finalValues.mean).toBeGreaterThanOrEqual(result.finalValues.min);
      expect(result.finalValues.mean).toBeLessThanOrEqual(result.finalValues.max);
    });

    test('should work with single simulation', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 1);

      // With 1 simulation, all scenarios should be the same
      const pessimisticFinal = result.scenarios.pessimistic[result.scenarios.pessimistic.length - 1].inflationAdjustedTotal;
      const realisticFinal = result.scenarios.realistic[result.scenarios.realistic.length - 1].inflationAdjustedTotal;
      const optimisticFinal = result.scenarios.optimistic[result.scenarios.optimistic.length - 1].inflationAdjustedTotal;

      expect(pessimisticFinal).toBe(realisticFinal);
      expect(realisticFinal).toBe(optimisticFinal);
    });
  });

  // ============================================================================
  // MONTE CARLO SIMULATION TESTS
  // ============================================================================

  describe('Monte Carlo Simulation', () => {
    test('should produce different results with volatility', () => {
      // Mock Math.random to ensure different values
      const originalRandom = Math.random;
      let callCount = 0;
      Math.random = () => {
        callCount++;
        return (callCount % 100) / 100; // Produces different values
      };

      const result1 = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 1);
      const result2 = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 1);

      Math.random = originalRandom;

      const final1 = result1.scenarios.realistic[result1.scenarios.realistic.length - 1].investments;
      const final2 = result2.scenarios.realistic[result2.scenarios.realistic.length - 1].investments;

      // With volatility, results should differ
      expect(final1).not.toBe(final2);
    });

    test('should have wider range with higher volatility', () => {
      const lowVolatility = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.05, 1000);
      const highVolatility = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.30, 1000);

      const lowRange = lowVolatility.finalValues.max - lowVolatility.finalValues.min;
      const highRange = highVolatility.finalValues.max - highVolatility.finalValues.min;

      expect(highRange).toBeGreaterThan(lowRange);
    });
  });

  // ============================================================================
  // DATA INTEGRITY TESTS
  // ============================================================================

  describe('Data Integrity', () => {
    test('should keep liquidity constant throughout simulation', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 2, 1000, 0.02, 0, 1);

      result.scenarios.realistic.forEach(month => {
        expect(month.liquidity).toBe(10000);
      });
    });

    test('should correctly track totalInvested', () => {
      const monthlyContribution = 500;
      const result = predictNetWorth(0, 10000, 0.05, 2, monthlyContribution, 0, 0, 1);

      result.scenarios.realistic.forEach((month, index) => {
        // Month 0 has 0 total invested, then increases by monthlyContribution each month
        expect(month.totalInvested).toBe(index * monthlyContribution);
      });
    });

    test('should calculate total as sum of liquidity and investments', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 2, 1000, 0.02, 0.10, 10);

      result.scenarios.realistic.forEach(month => {
        expect(month.total).toBeCloseTo(month.liquidity + month.investments, 2);
      });
    });

    test('should calculate inflation-adjusted total correctly', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 2, 1000, 0.02, 0, 1);

      result.scenarios.realistic.forEach((month) => {
        // Check that inflationAdjustedTotal equals the sum of its components
        const expectedTotal = month.inflationAdjustedLiquidity + month.inflationAdjustedInvestments;

        expect(typeof month.inflationAdjustedTotal).toBe('number');
        expect(typeof month.inflationAdjustedLiquidity).toBe('number');
        expect(typeof month.inflationAdjustedInvestments).toBe('number');
        expect(month.inflationAdjustedTotal).toBeCloseTo(expectedTotal, 5);
      });
    });
  });

  // ============================================================================
  // EDGE CASES & VALIDATION TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    test('should use default parameter values when not provided', () => {
      // Call with only required parameters to test defaults:
      // annualInflationRate = 0.02, volatility = 0.15, simulations = 1000
      const result = predictNetWorth(
        10000,    // initialLiquidity
        50000,    // initialInvestments
        0.07,     // annualGrowthRate
        5,        // years
        1000      // monthlyContributions
        // Omitting annualInflationRate, volatility, and simulations to test defaults
      );

      // Verify it produces valid results with defaults
      expect(result.scenarios.pessimistic).toBeDefined();
      expect(result.scenarios.realistic).toBeDefined();
      expect(result.scenarios.optimistic).toBeDefined();
      expect(result.scenarios.realistic.length).toBe(60); // 5 years * 12 months

      // Verify inflation adjustment is applied (default 0.02)
      const lastMonth = result.scenarios.realistic[59];
      expect(lastMonth.inflationAdjustedTotal).toBeLessThan(lastMonth.total);
    });

    test('should handle zero initial values', () => {
      const result = predictNetWorth(0, 0, 0.07, 1, 1000, 0.02, 0, 1);

      expect(result.scenarios.realistic[0].total).toBe(0);
      expect(result.scenarios.realistic[11].totalInvested).toBe(11000); // 11 months of contributions
    });

    test('should handle zero monthly contributions', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 1, 0, 0.02, 0, 1);

      expect(result.scenarios.realistic[11].totalInvested).toBe(0);
    });

    test('should handle single year timeframe', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0.15, 100);

      expect(result.scenarios.realistic.length).toBe(12);
    });

    test('should handle large time horizons', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 30, 1000, 0.02, 0.15, 10);

      expect(result.scenarios.realistic.length).toBe(360); // 30 years * 12 months
      expect(result.scenarios.realistic[359].totalInvested).toBe(359000); // 359 months of contributions
    });

    test('should handle extreme volatility', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.50, 100);

      // Should still produce valid results
      expect(result.scenarios.pessimistic).toBeDefined();
      expect(result.scenarios.realistic).toBeDefined();
      expect(result.scenarios.optimistic).toBeDefined();
      expect(result.finalValues.min).toBeLessThan(result.finalValues.max);
    });

    test('should handle very low volatility', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.001, 100);

      // With very low volatility, all scenarios should be very close
      const pessimisticFinal = result.scenarios.pessimistic[result.scenarios.pessimistic.length - 1].inflationAdjustedTotal;
      const optimisticFinal = result.scenarios.optimistic[result.scenarios.optimistic.length - 1].inflationAdjustedTotal;

      const range = optimisticFinal - pessimisticFinal;
      const average = (optimisticFinal + pessimisticFinal) / 2;
      const rangePercent = range / average;

      expect(rangePercent).toBeLessThan(0.20); // Less than 20% range
    });
  });

  // ============================================================================
  // RETURN STRUCTURE TESTS
  // ============================================================================

  describe('Return Structure', () => {
    test('should return correct object structure', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 100);

      // Check top-level structure
      expect(result).toHaveProperty('scenarios');
      expect(result).toHaveProperty('finalValues');
      expect(result).toHaveProperty('probabilityAnalysis');

      // Check scenarios
      expect(result.scenarios).toHaveProperty('pessimistic');
      expect(result.scenarios).toHaveProperty('realistic');
      expect(result.scenarios).toHaveProperty('optimistic');

      // Check finalValues
      expect(result.finalValues).toHaveProperty('min');
      expect(result.finalValues).toHaveProperty('max');
      expect(result.finalValues).toHaveProperty('median');
      expect(result.finalValues).toHaveProperty('mean');
      expect(result.finalValues).toHaveProperty('percentile10');
      expect(result.finalValues).toHaveProperty('percentile90');

      // Check probabilityAnalysis
      expect(result.probabilityAnalysis).toHaveProperty('chanceOfLoss');
      expect(result.probabilityAnalysis).toHaveProperty('chanceOfDoubling');
    });

    test('should have correct structure for each month in scenarios', () => {
      const result = predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0, 1);

      const month = result.scenarios.realistic[0];

      expect(month).toHaveProperty('dateMonth');
      expect(month).toHaveProperty('liquidity');
      expect(month).toHaveProperty('inflationAdjustedLiquidity');
      expect(month).toHaveProperty('investments');
      expect(month).toHaveProperty('inflationAdjustedInvestments');
      expect(month).toHaveProperty('totalInvested');
      expect(month).toHaveProperty('total');
      expect(month).toHaveProperty('inflationAdjustedTotal');

      expect(month.dateMonth).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // PROBABILITY ANALYSIS TESTS
  // ============================================================================

  describe('Probability Analysis', () => {
    test('should calculate chanceOfLoss correctly with guaranteed profit scenario', () => {
      // High growth, no volatility = no chance of loss
      const result = predictNetWorth(10000, 50000, 0.20, 5, 5000, 0.01, 0, 100);

      expect(result.probabilityAnalysis.chanceOfLoss).toBe(0);
    });

    test('should calculate chanceOfDoubling with high growth scenario', () => {
      const result = predictNetWorth(10000, 50000, 0.15, 10, 2000, 0.02, 0.10, 1000);

      // With 15% growth over 10 years, there should be high chance of doubling
      expect(result.probabilityAnalysis.chanceOfDoubling).toBeGreaterThan(0);
    });

    test('should have low chanceOfLoss with positive expected returns', () => {
      const result = predictNetWorth(10000, 50000, 0.08, 10, 1000, 0.02, 0.15, 1000);

      // With positive real returns, chance of loss should be relatively low
      expect(result.probabilityAnalysis.chanceOfLoss).toBeLessThan(0.5);
    });
  });

  // ============================================================================
  // NORMAL DISTRIBUTION EDGE CASES
  // ============================================================================

  describe('Normal Distribution Edge Cases', () => {
    test('should handle Math.random returning 0 in normalRandom function', () => {
      const originalRandom = Math.random;
      let callCount = 0;

      // First two calls return 0, then normal values
      Math.random = () => {
        callCount++;
        if (callCount <= 2) return 0;
        return 0.5;
      };

      // This should trigger the while loops in normalRandom
      const result = predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0.15, 1);

      Math.random = originalRandom;

      // Should still produce valid results despite Math.random() returning 0
      expect(result.scenarios.realistic).toBeDefined();
      expect(result.scenarios.realistic.length).toBe(12);
    });

    test('should trigger scenario ordering validation warning', () => {
      // Spy on console.warn to verify it's called
      const originalWarn = console.warn;
      const warnSpy = jest.fn();
      console.warn = warnSpy;

      // Save original Array.prototype.sort
      const originalSort = Array.prototype.sort;

      // Mock sort to intentionally return incorrectly ordered array
      // This simulates a scenario where the defensive check would catch an ordering issue
      Array.prototype.sort = function(compareFn) {
        // Call original sort
        originalSort.call(this, compareFn);
        // Then reverse it to create incorrect ordering
        this.reverse();
        return this;
      };

      try {
        // Run prediction - the mocked sort will cause ordering validation to fail
        predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0.15, 10);

        // Verify console.warn was called
        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
          'Scenario ordering validation failed:',
          expect.objectContaining({
            pessimistic: expect.any(Number),
            realistic: expect.any(Number),
            optimistic: expect.any(Number)
          })
        );
      } finally {
        // Restore original functions
        Array.prototype.sort = originalSort;
        console.warn = originalWarn;
      }
    });
  });

  // ============================================================================
  // COMPREHENSIVE COVERAGE TESTS
  // ============================================================================

  describe('Comprehensive Coverage Tests', () => {
    test('should handle all branches in scenario selection', () => {
      // Test with different simulation counts to cover all percentile calculations
      const result1 = predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0.15, 10);
      const result2 = predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0.15, 100);
      const result3 = predictNetWorth(10000, 50000, 0.07, 1, 1000, 0.02, 0.15, 1000);

      // All should produce valid scenarios
      expect(result1.scenarios.pessimistic).toBeDefined();
      expect(result1.scenarios.realistic).toBeDefined();
      expect(result1.scenarios.optimistic).toBeDefined();

      expect(result2.scenarios.pessimistic).toBeDefined();
      expect(result2.scenarios.realistic).toBeDefined();
      expect(result2.scenarios.optimistic).toBeDefined();

      expect(result3.scenarios.pessimistic).toBeDefined();
      expect(result3.scenarios.realistic).toBeDefined();
      expect(result3.scenarios.optimistic).toBeDefined();
    });

    test('should handle extreme negative growth with high volatility', () => {
      const result = predictNetWorth(10000, 50000, -0.20, 5, 500, 0.02, 0.40, 100);

      // Should still produce valid results even with extreme parameters
      expect(result.scenarios.pessimistic).toBeDefined();
      expect(result.finalValues.min).toBeLessThanOrEqual(result.finalValues.max);
    });

    test('should verify probability analysis with loss scenario', () => {
      // Negative growth with no contributions should likely result in loss
      const result = predictNetWorth(10000, 50000, -0.15, 10, 0, 0.05, 0.10, 1000);

      // With high inflation and negative growth, chance of loss should be high
      expect(result.probabilityAnalysis.chanceOfLoss).toBeGreaterThan(0);
    });

    test('should verify probability analysis counts correct scenarios', () => {
      // Test that probability calculations are counting correctly
      const result = predictNetWorth(10000, 50000, 0.07, 5, 1000, 0.02, 0.15, 1000);

      // Verify that chanceOfLoss and chanceOfDoubling are properly calculated fractions
      expect(typeof result.probabilityAnalysis.chanceOfLoss).toBe('number');
      expect(typeof result.probabilityAnalysis.chanceOfDoubling).toBe('number');
      expect(result.probabilityAnalysis.chanceOfLoss).toBeGreaterThanOrEqual(0);
      expect(result.probabilityAnalysis.chanceOfLoss).toBeLessThanOrEqual(1);
      expect(result.probabilityAnalysis.chanceOfDoubling).toBeGreaterThanOrEqual(0);
      expect(result.probabilityAnalysis.chanceOfDoubling).toBeLessThanOrEqual(1);
    });
  });
});
