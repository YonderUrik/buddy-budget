'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Button, Card, CardBody, CardHeader, Spinner, NumberInput, Tabs, Tab, Progress } from '@heroui/react';
import { predictNetWorth } from './nw_prediction';

export default function NetWorthPredictor() {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    initialLiquidity: 5000,
    initialInvestments: 25000,
    annualGrowthRate: 0.07,
    years: 5,
    monthlyContributions: 1000,
    annualInflationRate: 0.02,
    volatility: 0.15,
    simulations: 1000
  });

  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [hasCalculatedOnce, setHasCalculatedOnce] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('realistic');

  // Trigger auto-calculation when form data changes
  useEffect(() => {
    if (!hasCalculatedOnce) return;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        const result = predictNetWorth(
          formData.initialLiquidity,
          formData.initialInvestments,
          formData.annualGrowthRate,
          formData.years,
          formData.monthlyContributions,
          formData.annualInflationRate,
          formData.volatility,
          formData.simulations
        );
        setResults(result);
      } catch (error) {
        console.error('Auto-calculation error:', error);
      } finally {
        setIsCalculating(false);
      }
    }, 300);

    setDebounceTimer(timer);

    // Cleanup timer
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [formData, hasCalculatedOnce]);

  const handleInputChange = (value, name) => {
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setHasCalculatedOnce(true);
    try {
      const result = predictNetWorth(
        formData.initialLiquidity,
        formData.initialInvestments,
        formData.annualGrowthRate,
        formData.years,
        formData.monthlyContributions,
        formData.annualInflationRate,
        formData.volatility,
        formData.simulations
      );
      setResults(result);
    } catch (error) {
      console.error('Calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Get theme-appropriate colors for chart elements
  const getThemeColors = () => {
    const isDark = theme === 'dark';
    return {
      grid: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
      text: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
      axis: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
      cursor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
    };
  };

  // Get colors based on selected scenario
  const getScenarioColors = () => {
    switch (selectedScenario) {
      case 'pessimistic':
        return {
          liquidity: '#f87171', // red-400
          investments: '#dc2626' // red-600
        };
      case 'optimistic':
        return {
          liquidity: '#4ade80', // green-400
          investments: '#16a34a' // green-600
        };
      default: // realistic
        return {
          liquidity: '#60a5fa', // blue-400
          investments: '#2563eb' // blue-600
        };
    }
  };

  // Prepare chart data for stacked bar chart showing breakdown by category
  const prepareChartData = () => {
    if (!results) return [];

    const { pessimistic, realistic, optimistic } = results.scenarios;
    const selectedData = selectedScenario === 'pessimistic' ? pessimistic :
      selectedScenario === 'optimistic' ? optimistic : realistic;

    return selectedData.map((item, index) => ({
      month: index + 1,
      monthLabel: `Month ${index + 1}`,
      date: item.dateMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),

      // Inflation-adjusted values for true purchasing power
      liquidity: Math.round(item.inflationAdjustedLiquidity || 0),
      investments: Math.round(item.inflationAdjustedInvestments || 0),
      totalInvested: Math.round(item.totalInvested || 0),

      // Total for reference
      total: Math.round(item.inflationAdjustedTotal || 0)
    }));
  };

  // Custom tooltip for the stacked bar chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card className="shadow-2xl border border-divider bg-content1 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200">
          <CardBody className="p-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold border-b border-divider pb-2">{data.date}</p>
              {payload.map((entry, index) => (
                <div key={index} className="flex items-center justify-between gap-2 hover:bg-default-100 rounded px-2 py-1 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-sm font-medium">{entry.name}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(entry.value)}
                  </span>
                </div>
              ))}
              <div className="border-t border-divider pt-3 mt-3">
                <div className="flex justify-between items-center bg-default-50 rounded px-2 py-2">
                  <span className="text-sm font-semibold">Total:</span>
                  <span className="text-base font-bold">
                    {formatCurrency(data.total)}
                  </span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      );
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 will-change-transform">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <Card className="backdrop-blur-xl bg-background/30 border border-white/20 shadow-2xl hover:shadow-3xl hover:bg-background/40 transition-all duration-500 transform-gpu">
          <CardHeader className="backdrop-blur-sm bg-gradient-to-r from-white/10 to-white/5 border-b border-white/10">
            <h2 className="text-xl font-semibold">Parameters</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInput
                label="Initial Liquidity ($)"
                description="Cash you have available right now"
                value={formData.initialLiquidity}
                onValueChange={(value) => handleInputChange(value, 'initialLiquidity')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={1000}
              />

              <NumberInput
                label="Initial Investments ($)"
                description="Money already invested (stocks, funds, etc.)"
                value={formData.initialInvestments}
                onValueChange={(value) => handleInputChange(value, 'initialInvestments')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={1000}
              />

              <NumberInput
                label="Expected Growth Rate"
                description="7% per year (like stock market average)"
                value={formData.annualGrowthRate}
                onValueChange={(value) => handleInputChange(value, 'annualGrowthRate')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "percent",
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                }}
                min={0}
                max={1}
                step={0.01}
              />

              <NumberInput
                label="Years"
                description="How long to project into the future"
                value={formData.years}
                onValueChange={(value) => handleInputChange(value, 'years')}
                variant="bordered"
                size="sm"
                min={1}
                max={50}
                step={1}
              />

              <NumberInput
                label="Monthly Contributions ($)"
                description="How much you add each month"
                value={formData.monthlyContributions}
                onValueChange={(value) => handleInputChange(value, 'monthlyContributions')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={100}
              />

              <NumberInput
                label="Inflation Rate"
                value={formData.annualInflationRate}
                onValueChange={(value) => handleInputChange(value, 'annualInflationRate')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "percent",
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                }}
                min={0}
                max={0.2}
                step={0.001}
              />

              <NumberInput
                label="Volatility - How Bumpy the Ride?"
                description="5% = smooth, 15% = normal, 30% = wild swings"
                value={formData.volatility}
                onValueChange={(value) => handleInputChange(value, 'volatility')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "percent",
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                }}
                min={0.01}
                max={1}
                step={0.01}
              />

              <NumberInput
                label="Simulations"
                description="More simulations = more accurate results"
                value={formData.simulations}
                onValueChange={(value) => handleInputChange(value, 'simulations')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={100}
                max={10000}
                step={100}
              />
            </div>

            <div className="space-y-3">
              {isCalculating && hasCalculatedOnce && (
                <Progress
                  size="sm"
                  color="primary"
                  isIndeterminate
                  label="Running simulation..."
                />
              )}
              <Button
                onPress={handleCalculate}
                disabled={isCalculating}
                color="primary"
                size="lg"
                fullWidth
                startContent={isCalculating ? <Spinner size="sm" color="white" /> : null}
              >
                {isCalculating ? 'Calculating...' : 'Calculate Predictions'}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Results */}
        <Card className="backdrop-blur-xl bg-background/30 border border-white/20 shadow-2xl hover:shadow-3xl hover:bg-background/40 transition-all duration-500 transform-gpu">
          <CardHeader className="backdrop-blur-sm bg-gradient-to-r from-white/10 to-white/5 border-b border-white/10">
            <h2 className="text-xl font-semibold">Results</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            {results ? (
              <div className="space-y-6">
                {/* Chart */}
                <div>
                  <p className="text-sm text-default-500">Choose a scenario to view different outcomes</p>
                </div>
                {/* Scenario Tabs */}
                <div className="mb-4">
                  <div className="flex justify-center">
                    <Tabs
                      selectedKey={selectedScenario}
                      onSelectionChange={setSelectedScenario}
                      variant="bordered"
                      size="sm"
                      classNames={{
                        tabList: "gap-2 flex justify-center backdrop-blur-md bg-white/10 border border-white/20 rounded-lg p-1",
                        tab: "backdrop-blur-sm hover:bg-white/20 transition-all duration-300",
                        cursor: "backdrop-blur-lg bg-white/30 shadow-lg"
                      }}
                    >
                      <Tab
                        key="pessimistic"
                        title={
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span>Pessimistic (10th %)</span>
                          </div>
                        }
                      />
                      <Tab
                        key="realistic"
                        title={
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span>Realistic (50th %)</span>
                          </div>
                        }
                      />
                      <Tab
                        key="optimistic"
                        title={
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span>Optimistic (90th %)</span>
                          </div>
                        }
                      />
                    </Tabs>
                  </div>
                  <div className="mt-3 text-center">
                    {selectedScenario === 'pessimistic' && (
                      <p className="text-sm text-default-600">
                        Conservative scenario - only 10% of simulations performed worse
                      </p>
                    )}
                    {selectedScenario === 'realistic' && (
                      <p className="text-sm text-default-600">
                        Most likely scenario - typical market performance
                      </p>
                    )}
                    {selectedScenario === 'optimistic' && (
                      <p className="text-sm text-default-600">
                        Optimistic scenario - only 10% of simulations performed better
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-80  p-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={prepareChartData()} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={getThemeColors().grid} />
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={Math.max(1, Math.floor(formData.years * 12 / 12))}
                        tick={{ fill: getThemeColors().text, fontSize: 12 }}
                        axisLine={{ stroke: getThemeColors().axis }}
                        tickLine={{ stroke: getThemeColors().axis }}
                      />
                      <YAxis
                        tickFormatter={(value) => {
                          return new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            notation: 'compact',
                            maximumFractionDigits: 1
                          }).format(value);
                        }}
                        tick={{ fill: getThemeColors().text, fontSize: 12 }}
                        axisLine={{ stroke: getThemeColors().axis }}
                        tickLine={{ stroke: getThemeColors().axis }}
                      />
                      <Tooltip 
                        content={<CustomTooltip />} 
                        cursor={{ fill: getThemeColors().cursor }}
                        wrapperStyle={{ outline: 'none' }}
                        animationDuration={200}
                      />
                      <Legend />

                      <Bar
                        dataKey="liquidity"
                        stackId="networth"
                        fill={getScenarioColors().liquidity}
                        name="Cash (Liquidity)"
                      />
                      <Bar
                        dataKey="investments"
                        stackId="networth"
                        fill={getScenarioColors().investments}
                        name="Investment Value"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="text-default-500 text-center py-8">
                Enter your parameters and click "Calculate Predictions" to see results
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};