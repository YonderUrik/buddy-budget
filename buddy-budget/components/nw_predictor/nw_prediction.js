/**
 * Helper function to generate normally distributed random numbers using the Box-Muller transform
 * 
 * WHAT IS THE BOX-MULLER TRANSFORM?
 * The Box-Muller transform is a mathematical method that converts uniformly distributed random numbers
 * (like Math.random() which gives values between 0-1) into normally distributed random numbers
 * (bell curve distribution). This is crucial for financial modeling because:
 * 
 * 1. Stock market returns follow a normal distribution (bell curve) in reality
 * 2. Math.random() gives uniform distribution (all values equally likely)
 * 3. We need realistic market volatility simulation
 * 
 * HOW IT WORKS:
 * - Takes two uniform random numbers (u, v) between 0 and 1
 * - Applies polar form of Box-Muller transform: z = sqrt(-2 * ln(u)) * cos(2π * v)
 * - This produces a standard normal distribution (mean=0, stdDev=1)
 * - Then scales it to desired mean and standard deviation
 * 
 * WHY WE NEED THIS:
 * - Simulates realistic market behavior (some months up, some down, most near average)
 * - Creates the "volatility" that makes investment predictions more accurate
 * - Without this, all simulations would be identical (unrealistic)
 * 
 * @param {number} mean - The average value we want (center of bell curve)
 * @param {number} stdDev - Standard deviation (how spread out the values are)
 * @returns {number} A random number following normal distribution
 */
function normalRandom(mean, stdDev) {
   let u = 0, v = 0;

   // Ensure we don't get exactly 0 (would cause ln(0) = -infinity)
   while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
   while (v === 0) v = Math.random();

   // Box-Muller transform: converts uniform random to normal distribution
   // This is the mathematical magic that creates the bell curve
   const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);

   // Scale from standard normal (mean=0, stdDev=1) to our desired distribution
   return z * stdDev + mean;
}

export function predictNetWorth(
   initialLiquidity,
   initialInvestments,
   annualGrowthRate,
   years,
   monthlyContributions,
   annualInflationRate = 0.02,
   volatility = 0.15,
   simulations = 1000
) {
   const monthlyGrowthRate = (1 + annualGrowthRate) ** (1 / 12);
   const monthlyInflationRate = (1 + annualInflationRate) ** (1 / 12);

   // Convert annual volatility to monthly volatility
   // Volatility scales with square root of time, so monthly = annual / sqrt(12)
   const monthlyVolatility = volatility / Math.sqrt(12);

   // Single simulation function
   function runSingleSimulation() {
      const resultValues = [
         {
            dateMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            liquidity: initialLiquidity,
            inflationAdjustedLiquidity: initialLiquidity,
            investments: initialInvestments,
            inflationAdjustedInvestments: initialInvestments,
            totalInvested: 0,
            total: initialLiquidity + initialInvestments,
            totalInflationAdjusted: initialLiquidity + initialInvestments
         }
      ];

      for (let i = 1; i < years * 12; i++) {
         const previousMonth = resultValues[i - 1];

         const newDateMonth = new Date(previousMonth.dateMonth.getFullYear(), previousMonth.dateMonth.getMonth() + 1, 1);
         const newLiquidity = previousMonth.liquidity;

         // Apply random monthly return using normal distribution
         // This simulates market volatility - some months up, some down, based on historical patterns
         const randomReturn = normalRandom(monthlyGrowthRate, monthlyVolatility);
         const newInvestments = (previousMonth.investments * randomReturn) + monthlyContributions;
         const newTotalInvested = previousMonth.totalInvested + monthlyContributions;
         const newTotal = newLiquidity + newInvestments;

         // Apply inflation adjustment (real purchasing power)
         const inflationAdjustedLiquidity = previousMonth.inflationAdjustedLiquidity / monthlyInflationRate;
         const inflationAdjustedInvestments = newInvestments / monthlyInflationRate;
         const inflationAdjustedTotal = inflationAdjustedLiquidity + inflationAdjustedInvestments;

         resultValues.push({
            dateMonth: newDateMonth,
            liquidity: newLiquidity,
            inflationAdjustedLiquidity: inflationAdjustedLiquidity,
            investments: newInvestments,
            inflationAdjustedInvestments: inflationAdjustedInvestments,
            totalInvested: newTotalInvested,
            total: newTotal,
            inflationAdjustedTotal: inflationAdjustedTotal
         });
      }

      return resultValues;
   }

   // Calculate statistics from multiple simulations
   function calculateStatistics(allSimulations) {
      // Create array of simulations with their final values for sorting
      const simulationsWithFinalValues = allSimulations.map(sim => ({
         simulation: sim,
         finalValue: sim[sim.length - 1].inflationAdjustedTotal
      }));

      // Sort simulations by final value (worst to best)
      simulationsWithFinalValues.sort((a, b) => a.finalValue - b.finalValue);

      const finalValues = simulationsWithFinalValues.map(item => item.finalValue);
      const sortedSimulations = simulationsWithFinalValues.map(item => item.simulation);

      const percentile = (p) => finalValues[Math.floor(finalValues.length * p)];

      // Select scenarios based on actual performance ranking
      const pessimisticIndex = Math.floor(simulations * 0.1);
      const realisticIndex = Math.floor(simulations * 0.5);
      const optimisticIndex = Math.floor(simulations * 0.9);

      const scenarios = {
         pessimistic: sortedSimulations[pessimisticIndex],
         realistic: sortedSimulations[realisticIndex],
         optimistic: sortedSimulations[optimisticIndex]
      };

      // Validation: Ensure scenarios are ordered correctly
      const pessimisticFinal = scenarios.pessimistic[scenarios.pessimistic.length - 1].inflationAdjustedTotal;
      const realisticFinal = scenarios.realistic[scenarios.realistic.length - 1].inflationAdjustedTotal;
      const optimisticFinal = scenarios.optimistic[scenarios.optimistic.length - 1].inflationAdjustedTotal;

      if (pessimisticFinal > realisticFinal || realisticFinal > optimisticFinal) {
         console.warn('Scenario ordering validation failed:', {
            pessimistic: pessimisticFinal,
            realistic: realisticFinal,
            optimistic: optimisticFinal
         });
      }

      return {
         scenarios,
         finalValues: {
            min: Math.min(...finalValues),
            max: Math.max(...finalValues),
            median: percentile(0.5),
            mean: finalValues.reduce((a, b) => a + b, 0) / finalValues.length,
            percentile10: percentile(0.1),
            percentile90: percentile(0.9)
         },
         probabilityAnalysis: {
            chanceOfLoss: finalValues.filter(v => v < initialLiquidity + initialInvestments).length / finalValues.length,
            chanceOfDoubling: finalValues.filter(v => v >= (initialLiquidity + initialInvestments) * 2).length / finalValues.length
         }
      };
   }

   // Run multiple simulations
   console.log(`Running ${simulations} Monte Carlo simulations...`);
   const allSimulations = [];

   for (let sim = 0; sim < simulations; sim++) {
      if (sim % 100 === 0) {
         console.log(`Simulation ${sim}/${simulations}`);
      }
      allSimulations.push(runSingleSimulation());
   }

   // Calculate and return statistics
   return calculateStatistics(allSimulations);
}