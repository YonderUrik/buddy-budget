"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import { button as buttonStyles } from "@heroui/theme";
import { useTheme } from "next-themes";
import Image from "next/image";

import { title, subtitle } from "@/components/primitives";
import { siteConfig } from "@/config/site";
import {
  ChartIcon,
  WalletIcon,
  TargetIcon,
  TrendingIcon,
  ReceiptIcon,
  PiggyBankIcon,
  GithubIcon,
} from "@/components/icons";
import { FocusCards } from "@/components/ui/focus-cards";
import { TextReveal } from "@/components/ui/text-reveal";
import {
  FeatureSection,
  FeatureCard,
  LargeFeatureCard,
} from "@/components/ui/feature-section";

export default function Home() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const previewCards = [
    {
      title: "Net Worth Predictor",
      src:
        mounted && theme === "dark"
          ? "/previews/nw_dark.png"
          : "/previews/nw_light.png",
      description: "Monte Carlo simulations for financial forecasting",
      href: "/net-worth",
    },
    {
      title: "Stock Market Analysis",
      src: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
      description: "Real-time market data and charts",
      href: "#features",
    },
    {
      title: "Budget Dashboard",
      src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
      description: "Track expenses and manage budgets",
      href: "#features",
    },
  ];

  return (
    <div className="flex flex-col gap-20 py-8 md:py-12 relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center gap-8 text-center px-4 min-h-[80vh] -mt-8">
        <TextReveal delay={0}>
          <Link
            isExternal
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-blue-500/10 to-brand-gold-500/10 border border-brand-blue-500/20 hover:border-brand-blue-500/40 transition-all"
            href={siteConfig.links.github}
          >
            <GithubIcon size={20} />
            <span className="text-sm font-medium">Star us on GitHub</span>
          </Link>
        </TextReveal>

        <div className="inline-block max-w-4xl relative">
          <TextReveal delay={0.1}>
            <h1 className={title({ size: "lg" })}>
              <span className="bg-gradient-to-r from-brand-gold-500 to-brand-gold-500 bg-clip-text text-transparent">
                Buddy Budget
              </span>
            </h1>
          </TextReveal>

          <TextReveal delay={0.2}>
            <h2 className={title({ size: "sm", class: "mt-4" })}>
              Your Personal Finance Buddy
            </h2>
          </TextReveal>

          <TextReveal delay={0.3}>
            <p className={subtitle({ class: "mt-6 max-w-2xl mx-auto" })}>
              Take control of your finances with powerful tools for expense
              tracking, budgeting, investment monitoring, and financial
              predictions. Built with transparency in mind.
            </p>
          </TextReveal>
        </div>

        <TextReveal delay={0.4}>
          <div className="flex gap-4 flex-wrap justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                className={buttonStyles({
                  color: "primary",
                  radius: "full",
                  variant: "shadow",
                  size: "lg",
                })}
                href="#features"
              >
                Explore Features
              </Link>
            </motion.div>
          </div>
        </TextReveal>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          className="absolute bottom-8"
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-brand-blue-400/40 rounded-full flex items-start justify-center p-2">
            <motion.div
              animate={{ y: [0, 12, 0] }}
              className="w-1.5 h-1.5 bg-gradient-to-b from-brand-blue-500 to-brand-gold-500 rounded-full"
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section
        className="relative flex flex-col items-center gap-12 px-4"
        id="features"
      >
        <motion.div
          className="text-center max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            Powerful{" "}
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              Features
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            Everything you need to track and grow your net worth
          </p>
        </motion.div>

        <FeatureSection className="w-full">
          {/* Large Feature - Net Worth Predictor */}
          <LargeFeatureCard
            description="Predict your financial future with Monte Carlo simulations. Run thousands of scenarios based on your income, expenses, and investment returns to see the best case, worst case, and most likely outcomes for your net worth trajectory. Make informed decisions with statistical precision."
            icon={<ChartIcon className="text-brand-blue-500" size={40} />}
            image={
              <div className="relative w-full h-64 rounded-xl overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/net-worth-predictor.png" alt="Net Worth Predictor Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Net Worth Predictor Preview"
                  className="w-full h-full object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
                />
              </div>
            }
            title="Net Worth Predictor"
          />

          {/* Regular Features */}
          <FeatureCard
            description="Real-time stock tracking powered by Yahoo Finance with interactive charts and analytics. Monitor your portfolio with live market data."
            icon={<TrendingIcon className="text-brand-gold-500" size={32} />}
            image={
              <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/finance-tracking.png" alt="Finance Tracking Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Finance Tracking Preview"
                  className="w-full h-full object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80"
                />
              </div>
            }
            title="Finance Tracking"
          />

          <FeatureCard
            description="Monitor and optimize your investment portfolio with advanced analytics. View asset allocation, historical returns, and risk metrics."
            icon={<TargetIcon className="text-brand-blue-500" size={32} />}
            image={
              <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/portfolio-analytics.png" alt="Portfolio Analytics Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Portfolio Analytics Preview"
                  className="w-full h-full object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
                />
              </div>
            }
            title="Investment Portfolio"
          />

          <FeatureCard
            description="Visualize your complete financial picture. Track assets, liabilities, and net worth over time with beautiful charts and visualizations."
            icon={<WalletIcon className="text-brand-gold-500" size={32} />}
            image={
              <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/net-worth-dashboard.png" alt="Net Worth Dashboard Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Net Worth Dashboard Preview"
                  className="w-full h-full object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&q=80"
                />
              </div>
            }
            title="Net Worth Dashboard"
          />

          {/* Coming Soon Features */}
          <FeatureCard
            description="Track every expense effortlessly with smart categorization and insights. Coming soon to help you understand where your money goes."
            icon={<ReceiptIcon className="text-brand-blue-400" size={32} />}
            image={
              <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/expense-tracking.png" alt="Expense Tracking Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Expense Tracking Preview"
                  className="w-full h-full object-cover opacity-70"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1554224311-beee460ae6ba?w=800&q=80"
                />
              </div>
            }
            title="Expense Tracking"
          />

          <FeatureCard
            description="Create and manage budgets that adapt to your spending patterns. Coming soon to help you stay on track with your financial goals."
            icon={<WalletIcon className="text-brand-gold-400" size={32} />}
            image={
              <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/smart-budgeting.png" alt="Smart Budgeting Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Smart Budgeting Preview"
                  className="w-full h-full object-cover opacity-70"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80"
                />
              </div>
            }
            title="Smart Budgeting"
          />

          <FeatureCard
            description="Set financial goals and track your progress with visual milestones. Coming soon to help you achieve your dreams."
            icon={<PiggyBankIcon className="text-brand-blue-400" size={32} />}
            image={
              <div className="relative w-full h-40 rounded-lg overflow-hidden">
                {/* TODO: Replace with actual screenshot */}
                {/* <img src="/images/savings-goals.png" alt="Savings Goals Screenshot" className="w-full h-full object-cover" /> */}
                <Image
                  fill
                  alt="Savings Goals Preview"
                  className="w-full h-full object-cover opacity-70"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  src="https://images.unsplash.com/photo-1579621970795-87facc2f976d?w=800&q=80"
                />
              </div>
            }
            title="Savings Goals"
          />
        </FeatureSection>
      </section>

      {/* Preview Section */}
      <section
        className="relative flex flex-col items-center gap-12 px-4 py-16"
        id="preview"
      >
        <motion.div
          className="text-center max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            See it in{" "}
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              Action
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            Get a glimpse of what Buddy Budget can do for you
          </p>
        </motion.div>
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <FocusCards cards={previewCards} />
        </motion.div>
      </section>

      {/* Open Source Benefits Section */}
      <section className="relative flex flex-col items-center gap-8 px-4 py-16">
        <motion.div
          className="text-center max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            Built with{" "}
            <span className={title({ color: "yellow", size: "md" })}>
              Transparency
            </span>
          </h2>
          <p className={subtitle({ class: "mt-4" })}>
            Buddy Budget is 100% open source. Your financial data stays yours,
            and you can verify exactly how it works. Join our community of
            contributors making personal finance accessible to everyone.
          </p>
          <motion.div
            className="mt-8"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              isExternal
              as={Link}
              className="font-semibold"
              color="secondary"
              href={siteConfig.links.github}
              radius="full"
              size="lg"
              startContent={<GithubIcon size={20} />}
              variant="shadow"
            >
              Contribute on GitHub
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="relative flex flex-col items-center gap-8 px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          {[
            {
              title: "Smart",
              subtitle: "Financial Predictions",
              description:
                "Advanced algorithms for accurate financial forecasting",
              gradient: "from-brand-blue-500 to-brand-blue-600",
              delay: 0,
            },
            {
              title: "Real-time",
              subtitle: "Market Data",
              description: "Stay updated with live stock prices and trends",
              gradient: "from-brand-gold-500 to-brand-gold-600",
              delay: 0.1,
            },
            {
              title: "Open",
              subtitle: "Source & Transparent",
              description: "Community-driven development you can trust",
              gradient: "from-brand-blue-500 to-brand-gold-500",
              delay: 0.2,
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="group"
              initial={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: stat.delay }}
              viewport={{ once: true }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <div className="relative flex flex-col items-center p-8 rounded-2xl border border-brand-blue-500/20 dark:border-brand-blue-400/20 bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 dark:to-transparent backdrop-blur-sm hover:border-brand-blue-500/40 dark:hover:border-brand-blue-400/40 transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-500/5 via-transparent to-brand-gold-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div
                  className={`text-5xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-3 relative z-10`}
                >
                  {stat.title}
                </div>
                <div className="text-xl font-semibold mb-2 relative z-10">
                  {stat.subtitle}
                </div>
                <div className="text-sm text-default-500 text-center relative z-10">
                  {stat.description}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative flex flex-col items-center gap-6 text-center px-4 py-20 my-8">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand-blue-500/10 to-transparent dark:via-brand-blue-500/5 rounded-3xl" />
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, scale: 1 }}
        >
          <h2 className={title({ size: "md" })}>
            Ready to Master Your Finances?
          </h2>
          <p className={subtitle({ class: "mt-4 mb-8" })}>
            Start tracking, budgeting, and growing your wealth today with
            open-source transparency.
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                className="text-lg px-10 font-semibold"
                color="primary"
                radius="full"
                size="lg"
                variant="shadow"
              >
                Get Started Now
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                isExternal
                as={Link}
                className="text-lg px-10 font-semibold"
                color="secondary"
                href={siteConfig.links.github}
                radius="full"
                size="lg"
                startContent={<GithubIcon size={20} />}
                variant="bordered"
              >
                View on GitHub
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
