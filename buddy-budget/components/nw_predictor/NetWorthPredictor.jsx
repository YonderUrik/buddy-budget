'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { Button, Card, CardBody, CardHeader, Spinner, NumberInput, Tabs, Tab, Progress, Tooltip as UITooltip, Chip, Accordion, AccordionItem, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react';
import { predictNetWorth } from './nw_prediction';
import { formatCurrency, formatNumber, formatPercentage, getCurrencySymbol, getDefaultLocale } from '../../utils/format';

export default function NetWorthPredictor({ currency }) {
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [goalAmount, setGoalAmount] = useState(100000);
  const [chartView, setChartView] = useState('stacked'); // 'stacked', 'comparison', 'distribution'
  const { isOpen: isHowItWorksOpen, onOpen: onHowItWorksOpen, onClose: onHowItWorksClose } = useDisclosure();

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

  // Calculate probability of reaching goal
  const calculateGoalProbability = () => {
    if (!results) return null;

    const scenarios = [
      results.scenarios.pessimistic,
      results.scenarios.realistic,
      results.scenarios.optimistic
    ];

    const achievedGoal = scenarios.filter(scenario => {
      const finalValue = scenario[scenario.length - 1].inflationAdjustedTotal;
      return finalValue >= goalAmount;
    }).length;

    return (achievedGoal / 3) * 100;
  };

  // Calculate key metrics
  const getKeyMetrics = () => {
    if (!results) return null;

    const scenario = results.scenarios[selectedScenario];
    const finalMonth = scenario[scenario.length - 1];

    const totalContributions = finalMonth.totalInvested;
    const finalValue = finalMonth.inflationAdjustedTotal;
    const totalGrowth = finalValue - (formData.initialLiquidity + formData.initialInvestments + totalContributions);
    const nominalValue = finalMonth.total;
    const inflationImpact = nominalValue - finalValue;

    // Find breakeven month (when growth surpasses contributions)
    let breakevenMonth = null;
    for (let i = 0; i < scenario.length; i++) {
      const month = scenario[i];
      const invested = formData.initialLiquidity + formData.initialInvestments + month.totalInvested;
      if (month.inflationAdjustedTotal > invested) {
        breakevenMonth = i + 1;
        break;
      }
    }

    return {
      finalValue,
      totalContributions,
      totalGrowth,
      nominalValue,
      inflationImpact,
      breakevenMonth,
      roiPercentage: (totalGrowth / (formData.initialLiquidity + formData.initialInvestments + totalContributions)) * 100
    };
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
      total: Math.round(item.inflationAdjustedTotal || 0),

      // Contribution baseline (total amount invested)
      contributionBaseline: Math.round((formData.initialLiquidity + formData.initialInvestments + item.totalInvested) || 0)
    }));
  };

  // Prepare comparison chart data showing all three scenarios
  const prepareComparisonChartData = () => {
    if (!results) return [];

    const { pessimistic, realistic, optimistic } = results.scenarios;
    const length = Math.min(pessimistic.length, realistic.length, optimistic.length);

    return Array.from({ length }, (_, index) => ({
      month: index + 1,
      date: realistic[index].dateMonth.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      pessimistic: Math.round(pessimistic[index].inflationAdjustedTotal || 0),
      realistic: Math.round(realistic[index].inflationAdjustedTotal || 0),
      optimistic: Math.round(optimistic[index].inflationAdjustedTotal || 0),
      contributionBaseline: Math.round((formData.initialLiquidity + formData.initialInvestments + realistic[index].totalInvested) || 0)
    }));
  };

  // Custom tooltip for the stacked bar chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <Card className="shadow-2xl border border-divider bg-content1 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-200" style={{ position: 'relative', zIndex: 9999 }}>
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
                    {formatCurrency(entry.value, { currency })}
                  </span>
                </div>
              ))}
              {data.total && (
                <div className="border-t border-divider pt-3 mt-3">
                  <div className="flex justify-between items-center bg-default-50 rounded px-2 py-2">
                    <span className="text-sm font-semibold">Total:</span>
                    <span className="text-base font-bold">
                      {formatCurrency(data.total, { currency })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      );
    }
    return null;
  };

  // Info icon with tooltip component
  const InfoTooltip = ({ content }) => (
    <UITooltip
      content={<div className="max-w-xs p-2 text-sm">{content}</div>}
      placement="top"
      classNames={{
        content: "bg-content1 border border-divider shadow-xl"
      }}
    >
      <span className="inline-flex items-center justify-center w-4 h-4 ml-1 text-xs rounded-full bg-default-200 text-default-600 cursor-help hover:bg-default-300 transition-colors">
        i
      </span>
    </UITooltip>
  );


  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 will-change-transform">
      {/* Header with title and "How it Works" button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            Net Worth Predictor
          </h1>
          <p className="text-sm text-default-500 mt-1">
            Monte Carlo simulation with {formatNumber(formData.simulations, { decimals: 0 })} scenarios
          </p>
        </div>
        <Button
          onPress={onHowItWorksOpen}
          variant="flat"
          color="primary"
          size="sm"
        >
          How it Works
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <Card className="backdrop-blur-xl bg-background/30 border border-white/20 shadow-2xl hover:shadow-3xl hover:bg-background/40 transition-all duration-500 transform-gpu">
          <CardHeader className="backdrop-blur-sm bg-gradient-to-r from-white/10 to-white/5 border-b border-white/10">
            <h2 className="text-xl font-semibold">Parameters</h2>
          </CardHeader>
          <CardBody className="space-y-6">
            {/* Basic Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NumberInput
                label={
                  <span className="flex items-center">
                    Initial Liquidity ({getCurrencySymbol(currency)})
                    <InfoTooltip content="Cash you have available right now in savings, checking accounts, or other liquid assets that can be accessed immediately." />
                  </span>
                }
                description="Cash on hand"
                value={formData.initialLiquidity}
                onValueChange={(value) => handleInputChange(value, 'initialLiquidity')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={1000}
              />

              <NumberInput
                label={
                  <span className="flex items-center">
                    Initial Investments ({getCurrencySymbol(currency)})
                    <InfoTooltip content="Money already invested in stocks, bonds, ETFs, mutual funds, or other investment vehicles. This amount is subject to market growth and volatility." />
                  </span>
                }
                description="Already invested"
                value={formData.initialInvestments}
                onValueChange={(value) => handleInputChange(value, 'initialInvestments')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={1000}
              />

              <NumberInput
                label={
                  <span className="flex items-center">
                    Expected Growth Rate
                    <InfoTooltip content="Annual return rate for investments. Historical S&P 500 average is ~10% nominal (7% after inflation). Conservative: 5%, Moderate: 7%, Aggressive: 10%." />
                  </span>
                }
                description="7% = S&P 500 average"
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
                classNames={{
                  input: formData.annualGrowthRate > 0.12 ? 'text-warning' : ''
                }}
              />

              <NumberInput
                label="Time Horizon (Years)"
                description="Projection timeframe"
                value={formData.years}
                onValueChange={(value) => handleInputChange(value, 'years')}
                variant="bordered"
                size="sm"
                min={1}
                max={50}
                step={1}
              />

              <NumberInput
                label={
                  <span className="flex items-center">
                    Monthly Contributions ({getCurrencySymbol(currency)})
                    <InfoTooltip content="Amount you plan to invest each month. This is split between liquidity (emergency fund) and investments according to your strategy." />
                  </span>
                }
                description="Added monthly"
                value={formData.monthlyContributions}
                onValueChange={(value) => handleInputChange(value, 'monthlyContributions')}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={100}
              />

              <NumberInput
                label={
                  <span className="flex items-center">
                    Inflation Rate
                    <InfoTooltip content="Expected annual inflation rate. Historical US average is ~3%, but recent target is 2%. All results are shown in inflation-adjusted (real) dollars to show true purchasing power." />
                  </span>
                }
                description="2% = Fed target"
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
                label={
                  <span className="flex items-center">
                    Goal Amount ({getCurrencySymbol(currency)})
                    <InfoTooltip content="Set a target net worth to track your probability of achieving it. The tool will calculate the likelihood of reaching this goal based on your parameters and the three scenarios." />
                  </span>
                }
                description="Target net worth"
                value={goalAmount}
                onValueChange={setGoalAmount}
                variant="bordered"
                size="sm"
                formatOptions={{
                  style: "currency",
                  currency: currency,
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }}
                min={0}
                step={10000}
              />
            </div>

            {/* Advanced Settings Accordion */}
            <Accordion
              variant="bordered"
              className="px-0"
              selectedKeys={showAdvanced ? ['advanced'] : []}
              onSelectionChange={(keys) => setShowAdvanced(keys.has('advanced'))}
            >
              <AccordionItem
                key="advanced"
                className="px-5"
                title={
                  <span className="text-sm font-semibold text-default-600">
                    Advanced Settings
                  </span>
                }
                subtitle="Volatility and simulation parameters"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  <NumberInput
                    label={
                      <span className="flex items-center">
                        Volatility
                        <InfoTooltip content="Market volatility (standard deviation of returns). Represents how much returns fluctuate. Stocks: 15-20%, Bonds: 5-10%, Mixed portfolio: 10-15%. Higher volatility = more uncertainty in outcomes." />
                      </span>
                    }
                    description="5% = low, 15% = normal, 25% = high"
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
                    label={
                      <span className="flex items-center">
                        Simulations
                        <InfoTooltip content="Number of Monte Carlo simulations to run. More simulations = more accurate probability estimates but slower calculation. 1000 is typically sufficient for reliable results." />
                      </span>
                    }
                    description={`${formatNumber(1000, {decimals : 0})} = good balance`}
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
              </AccordionItem>
            </Accordion>

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
                {/* Key Metrics Dashboard */}
                {(() => {
                  const metrics = getKeyMetrics();
                  if (!metrics) return null;

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20">
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500 mb-1">Final Value</p>
                          <p className="text-lg font-bold">{formatCurrency(metrics.finalValue, { currency })}</p>
                          <p className="text-xs text-default-400 mt-1">
                            {metrics.roiPercentage >= 0 ? '+' : ''}{formatPercentage(metrics.roiPercentage / 100)}% ROI
                          </p>
                        </CardBody>
                      </Card>

                      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20">
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500 mb-1">Total Growth</p>
                          <p className="text-lg font-bold text-success">{formatCurrency(metrics.totalGrowth, { currency })}</p>
                          <p className="text-xs text-default-400 mt-1">Earnings</p>
                        </CardBody>
                      </Card>

                      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500 mb-1">Contributed</p>
                          <p className="text-lg font-bold">{formatCurrency(metrics.totalContributions, { currency })}</p>
                          <p className="text-xs text-default-400 mt-1">Your money</p>
                        </CardBody>
                      </Card>
                    </div>
                  );
                })()}

                {/* Enhanced Insights */}
                {(() => {
                  const metrics = getKeyMetrics();
                  if (!metrics) return null;

                  const goalProb = calculateGoalProbability();
                  const breakevenProgress = metrics.breakevenMonth ? (metrics.breakevenMonth / (formData.years * 12)) * 100 : 0;
                  const breakevenDate = metrics.breakevenMonth ?
                    new Date(new Date().setMonth(new Date().getMonth() + metrics.breakevenMonth)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : null;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                      {/* Goal Progress Card */}
                      {goalProb !== null && (
                        <Card className={`bg-gradient-to-br border transition-all duration-300 hover:scale-[1.02] ${goalProb >= 66
                          ? 'from-green-500/10 via-emerald-500/5 to-teal-500/10 border-green-500/30 hover:border-green-500/50'
                          : goalProb >= 33
                            ? 'from-amber-500/10 via-yellow-500/5 to-orange-500/10 border-amber-500/30 hover:border-amber-500/50'
                            : 'from-red-500/10 via-rose-500/5 to-pink-500/10 border-red-500/30 hover:border-red-500/50'
                          }`}>
                          <CardBody className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="text-3xl">
                                {goalProb >= 66 ? '🎯' : goalProb >= 33 ? '⚠️' : '🚨'}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className={`text-sm font-bold ${goalProb >= 66 ? 'text-green-600 dark:text-green-400'
                                    : goalProb >= 33 ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-red-600 dark:text-red-400'
                                    }`}>
                                    Goal Probability
                                  </h4>
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={goalProb >= 66 ? "success" : goalProb >= 33 ? "warning" : "danger"}
                                    className="font-bold"
                                  >
                                    {goalProb.toFixed(0)}%
                                  </Chip>
                                </div>

                                <div className="space-y-1">
                                  <p className="text-xs text-default-600 leading-relaxed">
                                    <strong>What it means:</strong> Based on 3 scenarios (pessimistic, realistic, optimistic),
                                    this shows the likelihood of reaching <strong>{formatCurrency(goalAmount, { currency })}</strong> in {formData.years} years.
                                  </p>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-default-500">Scenarios meeting goal</span>
                                    <span className="font-semibold">{(goalProb / 100 * 3).toFixed(0)} out of 3</span>
                                  </div>
                                  <Progress
                                    value={goalProb}
                                    color={goalProb >= 66 ? "success" : goalProb >= 33 ? "warning" : "danger"}
                                    size="sm"
                                    className="max-w-full"
                                  />
                                </div>

                                {goalProb < 50 && (
                                  <p className="text-xs text-default-500 italic mt-2">
                                    💡 Tip: Try increasing monthly contributions or extending your timeline to improve your odds.
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      )}
                    </div>
                  );
                })()}

                {/* Chart View Toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-default-500">Choose a view</p>
                  <Tabs
                    selectedKey={chartView}
                    onSelectionChange={setChartView}
                    size="sm"
                    variant="bordered"
                  >
                    <Tab key="stacked" title="Breakdown" />
                    <Tab key="comparison" title="All Scenarios" />
                  </Tabs>
                </div>
                {/* Scenario Tabs - Only shown in stacked view */}
                {chartView === 'stacked' && (
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
                )}

                {/* Chart - Stacked Bar View */}
                {chartView === 'stacked' && (
                  <div className="h-80 p-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={prepareChartData()} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
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
                          tickFormatter={(value) => formatCurrency(value, { currency, notation: 'compact' })}
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
                )}

                {/* Chart - Comparison Area View */}
                {chartView === 'comparison' && (
                  <div className="h-80 p-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prepareComparisonChartData()} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPessimistic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorRealistic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorOptimistic" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
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
                          tickFormatter={(value) => formatCurrency(value, { currency, notation: 'compact' })}
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

                        {/* Contribution Baseline */}
                        <Area
                          type="monotone"
                          dataKey="contributionBaseline"
                          stroke="#9ca3af"
                          strokeDasharray="5 5"
                          fill="none"
                          name="Total Invested"
                          strokeWidth={2}
                        />

                        {/* Three scenarios */}
                        <Area
                          type="monotone"
                          dataKey="pessimistic"
                          stroke="#f87171"
                          fillOpacity={1}
                          fill="url(#colorPessimistic)"
                          name="Pessimistic (10th %)"
                        />
                        <Area
                          type="monotone"
                          dataKey="realistic"
                          stroke="#60a5fa"
                          fillOpacity={1}
                          fill="url(#colorRealistic)"
                          name="Realistic (50th %)"
                        />
                        <Area
                          type="monotone"
                          dataKey="optimistic"
                          stroke="#4ade80"
                          fillOpacity={1}
                          fill="url(#colorOptimistic)"
                          name="Optimistic (90th %)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 space-y-6">
                {/* Animated Icon */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full p-8 backdrop-blur-sm border border-blue-500/20">
                    <svg
                      className="w-16 h-16 text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                </div>

                {/* Title and Description */}
                <div className="text-center space-y-2 max-w-md">
                  <h3 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                    Ready to Predict Your Future?
                  </h3>
                  <p className="text-sm text-default-500 leading-relaxed">
                    Enter your financial parameters on the left and click <strong>"Calculate Predictions"</strong> to see how your wealth could grow over time.
                  </p>
                </div>

                {/* Feature Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                  >
                    📊 Monte Carlo Simulation
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                  >
                    💰 3 Scenarios
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  >
                    📈 Inflation Adjusted
                  </Chip>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* How it Works Modal */}
      <Modal
        isOpen={isHowItWorksOpen}
        onClose={onHowItWorksClose}
        size="3xl"
        scrollBehavior="inside"
        classNames={{
          backdrop: "backdrop-blur-sm",
          wrapper: "items-center",
          base: "max-h-[90vh]",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-divider">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              How the Net Worth Predictor Works
            </h2>
            <p className="text-sm text-default-500 font-normal">
              Understanding Monte Carlo simulation and financial projections
            </p>
          </ModalHeader>
          <ModalBody className="py-6">
            <div className="space-y-6">
              {/* Monte Carlo Simulation */}
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">🎲</span>
                  Monte Carlo Simulation
                </h3>
                <p className="text-sm text-default-600 mb-3">
                  Instead of giving you just one prediction, we run thousands of different scenarios (simulations)
                  to show you the range of possible outcomes. Think of it like rolling dice thousands of times
                  to understand all the ways your investments might perform.
                </p>
                <div className="bg-default-100 rounded-lg p-4 space-y-2">
                  <p className="text-sm"><strong>Why this matters:</strong> Markets don't move in straight lines.
                    Some years are great, others are terrible. Monte Carlo helps you see the full picture.</p>
                </div>
              </div>

              {/* Box-Muller Transform */}
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  Box-Muller Transform
                </h3>
                <p className="text-sm text-default-600 mb-3">
                  This mathematical technique converts random numbers into realistic market returns that follow
                  a "bell curve" distribution - just like real market behavior. Most returns cluster around the
                  average, with occasional extreme highs and lows.
                </p>
                <div className="bg-default-100 rounded-lg p-4 space-y-2">
                  <p className="text-sm"><strong>In simple terms:</strong> Instead of unrealistic coin-flip randomness,
                    we simulate market behavior that mirrors historical patterns - most months near average,
                    occasional big swings.</p>
                </div>
              </div>

              {/* Percentile Scenarios */}
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">📈</span>
                  Understanding Scenarios
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold">Pessimistic (10th Percentile)</p>
                      <p className="text-xs text-default-600">
                        Only 10% of simulations performed worse than this. If things go poorly,
                        this is likely the worst you'll experience. Good for conservative planning.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold">Realistic (50th Percentile - Median)</p>
                      <p className="text-xs text-default-600">
                        Half of simulations performed better, half performed worse. This is your
                        "most likely" outcome based on typical market conditions.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-semibold">Optimistic (90th Percentile)</p>
                      <p className="text-xs text-default-600">
                        Only 10% of simulations performed better. If markets are strong,
                        this is a reasonable upper bound. Don't count on exceeding this.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inflation Adjustment */}
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">💵</span>
                  Inflation Adjustment
                </h3>
                <p className="text-sm text-default-600 mb-3">
                  All results are shown in "real" (inflation-adjusted) dollars, showing what your money
                  can actually buy in today's purchasing power. A million dollars in 30 years isn't worth
                  a million dollars today!
                </p>
                <div className="bg-default-100 rounded-lg p-4">
                  <p className="text-sm"><strong>Example:</strong> At 2% inflation, {formatCurrency(100000, { currency })} in 20 years
                    will only buy what {formatCurrency(67297, { currency })} buys today. We account for this automatically.</p>
                </div>
              </div>

              {/* Volatility */}
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">🎢</span>
                  Volatility
                </h3>
                <p className="text-sm text-default-600 mb-3">
                  Volatility measures how bumpy the ride is. Higher volatility means more uncertainty -
                  bigger swings up and down. Stocks typically have 15-20% volatility, bonds 5-10%.
                </p>
                <div className="bg-default-100 rounded-lg p-4 space-y-2">
                  <p className="text-sm"><strong>Rule of thumb:</strong></p>
                  <ul className="text-xs space-y-1 ml-4 list-disc">
                    <li>5-8%: Conservative (mostly bonds)</li>
                    <li>10-15%: Balanced (mix of stocks and bonds)</li>
                    <li>15-20%: Aggressive (mostly stocks)</li>
                    <li>25%+: Very aggressive (high-risk investments)</li>
                  </ul>
                </div>
              </div>

              {/* Limitations */}
              <div>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  Important Limitations
                </h3>
                <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                  <ul className="text-sm space-y-2 list-disc ml-4 text-warning-800">
                    <li>Past performance doesn't guarantee future results</li>
                    <li>This tool assumes you maintain consistent contributions (no job loss, emergencies, etc.)</li>
                    <li>Real markets can be more extreme than simulations suggest</li>
                    <li>Taxes, fees, and transaction costs are not included</li>
                    <li>This is educational only - not financial advice</li>
                  </ul>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="border-t border-divider">
            <Button color="primary" onPress={onHowItWorksClose}>
              Got it!
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};