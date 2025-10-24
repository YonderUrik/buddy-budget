"use client";

import { motion } from "framer-motion";

import { title, subtitle } from "@/components/primitives";
import { TextReveal } from "@/components/ui/text-reveal";
import { FeatureSection, FeatureCard } from "@/components/ui/feature-section";
import NetWorthPredictor from "@/components/nw_predictor/NetWorthPredictor";
import {
  DiceIcon,
  BarChartIcon,
  ChartIcon,
  DollarIcon,
  ActivityIcon,
  AlertIcon,
} from "@/components/icons";

export default function NetWorthPage() {
  return (
    <div className="flex flex-col gap-20 py-8 md:py-12 relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center gap-8 text-center px-4">
        <TextReveal delay={0}>
          <h1 className={title({ size: "lg" })}>
            Net Worth{" "}
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              Predictor
            </span>
          </h1>
        </TextReveal>

        <TextReveal delay={0.1}>
          <p className={subtitle({ class: "mt-4 max-w-3xl mx-auto" })}>
            Predict your future net worth using advanced Monte Carlo
            simulations. Get realistic forecasts based on your income, savings,
            and investment returns.
          </p>
        </TextReveal>
      </section>

      {/* Net Worth Predictor Component */}
      <section className="relative flex flex-col items-center gap-8 px-4">
        <motion.div
          className="w-full max-w-7xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <NetWorthPredictor currency={null} />
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section className="relative flex flex-col items-center gap-12 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            How It{" "}
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              Works
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2 max-w-3xl mx-auto" })}>
            Understanding Monte Carlo simulation and financial projections
          </p>
        </motion.div>

        <FeatureSection className="w-full">
          {/* Monte Carlo Simulation */}
          <FeatureCard
            description={
              <p className="text-sm text-default-600">
                Instead of giving you just one prediction, we run thousands of
                different scenarios (simulations) to show you the range of
                possible outcomes. Think of it like rolling dice thousands of
                times to understand all the ways your investments might perform.
                Markets don&apos;t move in straight lines—some years are great,
                others are terrible. Monte Carlo helps you see the full picture.
              </p>
            }
            icon={<DiceIcon className="text-brand-blue-500" size={32} />}
            title="Monte Carlo Simulation"
          />

          {/* Box-Muller Transform */}
          <FeatureCard
            description={
              <p className="text-sm text-default-600">
                This mathematical technique converts random numbers into
                realistic market returns that follow a &apos;bell curve&apos;
                distribution—just like real market behavior. Most returns
                cluster around the average, with occasional extreme highs and
                lows. Instead of unrealistic coin-flip randomness, we simulate
                market behavior that mirrors historical patterns: most months
                near average, occasional big swings.
              </p>
            }
            icon={<BarChartIcon className="text-brand-gold-500" size={32} />}
            title="Box-Muller Transform"
          />

          {/* Understanding Scenarios */}
          <FeatureCard
            description={
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-default-600">
                      Pessimistic (10th Percentile)
                    </p>
                    <p className="text-sm text-default-600">
                      Only 10% of simulations performed worse than this. If
                      things go poorly, this is likely the worst you&apos;ll
                      experience. Good for conservative planning.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-brand-blue-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-default-600">
                      Realistic (50th Percentile - Median)
                    </p>
                    <p className="text-sm text-default-600">
                      Half of simulations performed better, half performed
                      worse. This is your &quot;most likely&quot; outcome based
                      on typical market conditions.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-default-600">
                      Optimistic (90th Percentile)
                    </p>
                    <p className="text-sm text-default-600">
                      Only 10% of simulations performed better. If markets are
                      strong, this is a reasonable upper bound. Don&apos;t count
                      on exceeding this.
                    </p>
                  </div>
                </div>
              </div>
            }
            icon={<ChartIcon className="text-brand-blue-500" size={32} />}
            title="Understanding Scenarios"
          />

          {/* Inflation Adjustment */}
          <FeatureCard
            description={
              <div className="space-y-2">
                <p className="text-sm text-default-600">
                  All results are shown in &quot;real&quot; (inflation-adjusted)
                  dollars, showing what your money can actually buy in
                  today&apos;s purchasing power. A million dollars in 30 years
                  isn&apos;t worth a million dollars today!
                </p>
                <div className="bg-default-100 rounded-lg p-3 mt-2">
                  <p className="text-sm">
                    <strong>Example:</strong> At 2% inflation, $100,000 in 20
                    years will only buy what $67,297 buys today. We account for
                    this automatically.
                  </p>
                </div>
              </div>
            }
            icon={<DollarIcon className="text-brand-gold-500" size={32} />}
            title="Inflation Adjustment"
          />

          {/* Volatility */}
          <FeatureCard
            description={
              <div className="space-y-2">
                <p className="text-sm text-default-600">
                  Volatility measures how bumpy the ride is. Higher volatility
                  means more uncertainty— bigger swings up and down. Stocks
                  typically have 15-20% volatility, bonds 5-10%.
                </p>
                <div className="bg-default-100 rounded-lg p-3 mt-2">
                  <p className="text-sm font-semibold mb-2">Rule of thumb:</p>
                  <ul className="text-xs space-y-1 ml-4 list-disc">
                    <li>5-8%: Conservative (mostly bonds)</li>
                    <li>10-15%: Balanced (mix of stocks and bonds)</li>
                    <li>15-20%: Aggressive (mostly stocks)</li>
                    <li>25%+: Very aggressive (high-risk investments)</li>
                  </ul>
                </div>
              </div>
            }
            icon={<ActivityIcon className="text-brand-blue-500" size={32} />}
            title="Volatility"
          />

          {/* Limitations */}
          <FeatureCard
            description={
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                <ul className="text-sm space-y-2 list-disc ml-4 text-warning-800 dark:text-warning-600">
                  <li>
                    Past performance doesn&apos;t guarantee future results
                  </li>
                  <li>
                    This tool assumes you maintain consistent contributions (no
                    job loss, emergencies, etc.)
                  </li>
                  <li>
                    Real markets can be more extreme than simulations suggest
                  </li>
                  <li>Taxes, fees, and transaction costs are not included</li>
                  <li>This is educational only - not financial advice</li>
                </ul>
              </div>
            }
            icon={<AlertIcon className="text-warning-600" size={32} />}
            title="Important Limitations"
          />
        </FeatureSection>
      </section>
    </div>
  );
}
