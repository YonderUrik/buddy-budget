'use client';

import { motion } from "framer-motion";
import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Badge } from "@heroui/badge";
import { button as buttonStyles } from "@heroui/theme";
import { title, subtitle } from "@/components/primitives";
import { siteConfig } from "@/config/site";
import {
  ChartIcon,
  WalletIcon,
  TargetIcon,
  TrendingIcon,
  ReceiptIcon,
  PiggyBankIcon,
  GithubIcon
} from "@/components/icons";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { FocusCards } from "@/components/ui/focus-cards";
import { FloatingOrbs } from "@/components/ui/floating-orbs";
import { TextReveal } from "@/components/ui/text-reveal";

export default function Home() {
  const featureCards = [
    {
      title: "Net Worth Predictor",
      description: "AI-powered Monte Carlo simulations to predict your future net worth with statistical accuracy.",
      icon: <ChartIcon size={20} className="text-primary" />,
      badge: <Chip size="sm" color="success" variant="flat">Available</Chip>,
      className: "md:col-span-2",
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 dark:from-violet-500/10 dark:to-purple-500/10 border border-violet-500/20 items-center justify-center">
          <div className="text-4xl">📊</div>
        </div>
      ),
    },
    {
      title: "Finance Tracking",
      description: "Real-time stock tracking powered by Yahoo Finance with interactive charts and analytics.",
      icon: <TrendingIcon size={20} className="text-success" />,
      badge: <Chip size="sm" color="success" variant="flat">Available</Chip>,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10 border border-green-500/20 items-center justify-center">
          <div className="text-4xl">📈</div>
        </div>
      ),
    },
    {
      title: "Expense Tracking",
      description: "Track every expense effortlessly with smart categorization and insights.",
      icon: <ReceiptIcon size={20} className="text-warning" />,
      badge: <Chip size="sm" variant="flat">Coming Soon</Chip>,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 dark:from-orange-500/10 dark:to-amber-500/10 border border-orange-500/20 items-center justify-center">
          <div className="text-4xl">🧾</div>
        </div>
      ),
    },
    {
      title: "Smart Budgeting",
      description: "Create and manage budgets that adapt to your spending patterns.",
      icon: <WalletIcon size={20} className="text-secondary" />,
      badge: <Chip size="sm" variant="flat">Coming Soon</Chip>,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-lg bg-gradient-to-br from-pink-500/20 to-rose-500/20 dark:from-pink-500/10 dark:to-rose-500/10 border border-pink-500/20 items-center justify-center">
          <div className="text-4xl">💰</div>
        </div>
      ),
    },
    {
      title: "Investment Portfolio",
      description: "Monitor and optimize your investment portfolio with advanced analytics.",
      icon: <TargetIcon size={20} className="text-primary" />,
      badge: <Chip size="sm" variant="flat">Coming Soon</Chip>,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/10 dark:to-cyan-500/10 border border-blue-500/20 items-center justify-center">
          <div className="text-4xl">🎯</div>
        </div>
      ),
    },
    {
      title: "Savings Goals",
      description: "Set financial goals and track your progress with visual milestones.",
      icon: <PiggyBankIcon size={20} className="text-danger" />,
      badge: <Chip size="sm" variant="flat">Coming Soon</Chip>,
      header: (
        <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-lg bg-gradient-to-br from-red-500/20 to-pink-500/20 dark:from-red-500/10 dark:to-pink-500/10 border border-red-500/20 items-center justify-center">
          <div className="text-4xl">🐷</div>
        </div>
      ),
    },
  ];

  const previewCards = [
    {
      title: "Net Worth Predictor",
      src: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
      description: "Monte Carlo simulations for financial forecasting",
    },
    {
      title: "Stock Market Analysis",
      src: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
      description: "Real-time market data and charts",
    },
    {
      title: "Budget Dashboard",
      src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
      description: "Track expenses and manage budgets",
    },
  ];

  return (
    <div className="flex flex-col gap-20 py-8 md:py-12 relative overflow-hidden">
      {/* Floating Background Orbs */}
      <FloatingOrbs />

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center gap-8 text-center px-4 min-h-[80vh] -mt-8">
        <TextReveal delay={0}>
          <Link
            isExternal
            href={siteConfig.links.github}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-default-100 dark:bg-default-50 hover:bg-default-200 dark:hover:bg-default-100 transition-colors"
          >
            <GithubIcon size={20} />
            <span className="text-sm font-medium">Star us on GitHub</span>
          </Link>
        </TextReveal>

        <div className="inline-block max-w-4xl relative">
          <TextReveal delay={0.1}>
            <h1 className={title({ size: "lg" })}>
              <span className={title({ color: "violet" })}>Buddy Budget</span>
            </h1>
          </TextReveal>

          <TextReveal delay={0.2}>
            <h2 className={title({ size: "sm", class: "mt-4" })}>
              Your AI-Powered Personal Finance Companion
            </h2>
          </TextReveal>

          <TextReveal delay={0.3}>
            <p className={subtitle({ class: "mt-6 max-w-2xl mx-auto" })}>
              Take control of your finances with powerful tools for expense tracking,
              budgeting, investment monitoring, and AI-powered predictions. Built with transparency in mind.
            </p>
          </TextReveal>
        </div>

        <TextReveal delay={0.4}>
          <div className="flex gap-4 flex-wrap justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
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
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                as={Link}
                isExternal
                href={siteConfig.links.github}
                variant="flat"
                color="success"
                radius="full"
                size="lg"
                startContent={<GithubIcon size={20} />}
              >
                View Source
              </Button>
            </motion.div>
          </div>
        </TextReveal>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-8"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-6 h-10 border-2 border-default-300 rounded-full flex items-start justify-center p-2">
            <motion.div
              className="w-1.5 h-1.5 bg-default-400 rounded-full"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative flex flex-col items-center gap-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl"
        >
          <h2 className={title({ size: "md" })}>
            Powerful <span className={title({ color: "green", size: "md" })}>Features</span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            Everything you need to manage your personal finances in one place
          </p>
        </motion.div>

        <BentoGrid>
          {featureCards.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <BentoGridItem
                title={item.title}
                description={item.description}
                header={item.header}
                icon={item.icon}
                badge={item.badge}
                className={item.className}
              />
            </motion.div>
          ))}
        </BentoGrid>
      </section>

      {/* Preview Section */}
      <section id="preview" className="relative flex flex-col items-center gap-12 px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl"
        >
          <h2 className={title({ size: "md" })}>
            See it in <span className={title({ color: "blue", size: "md" })}>Action</span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            Get a glimpse of what Buddy Budget can do for you
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full"
        >
          <FocusCards cards={previewCards} />
        </motion.div>
      </section>

      {/* Open Source Benefits Section */}
      <section className="relative flex flex-col items-center gap-8 px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl"
        >
          <h2 className={title({ size: "md" })}>
            Built with <span className={title({ color: "green", size: "md" })}>Transparency</span>
          </h2>
          <p className={subtitle({ class: "mt-4" })}>
            Buddy Budget is 100% open source. Your financial data stays yours, and you can verify exactly how it works.
            Join our community of contributors making personal finance accessible to everyone.
          </p>
          <motion.div
            className="mt-8"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              as={Link}
              isExternal
              href={siteConfig.links.github}
              size="lg"
              color="success"
              variant="shadow"
              radius="full"
              startContent={<GithubIcon size={20} />}
              className="font-semibold"
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
              subtitle: "AI-Powered Predictions",
              description: "Advanced algorithms for accurate financial forecasting",
              color: "primary",
              delay: 0,
            },
            {
              title: "Real-time",
              subtitle: "Market Data",
              description: "Stay updated with live stock prices and trends",
              color: "success",
              delay: 0.1,
            },
            {
              title: "Open",
              subtitle: "Source & Transparent",
              description: "Community-driven development you can trust",
              color: "secondary",
              delay: 0.2,
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: stat.delay }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="group"
            >
              <div className="relative flex flex-col items-center p-8 rounded-2xl border border-default-200 dark:border-default-100 bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 dark:to-transparent backdrop-blur-sm hover:border-default-300 dark:hover:border-default-200 transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className={`text-5xl font-bold text-${stat.color} mb-3 relative z-10`}>
                  {stat.title}
                </div>
                <div className="text-xl font-semibold mb-2 relative z-10">{stat.subtitle}</div>
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
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary-50/10 to-transparent dark:via-primary-50/5 rounded-3xl" />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <h2 className={title({ size: "md" })}>
            Ready to Master Your Finances?
          </h2>
          <p className={subtitle({ class: "mt-4 mb-8" })}>
            Start tracking, budgeting, and growing your wealth today with open-source transparency.
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                color="primary"
                variant="shadow"
                radius="full"
                className="text-lg px-10 font-semibold"
              >
                Get Started Now
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                as={Link}
                isExternal
                href={siteConfig.links.github}
                size="lg"
                variant="bordered"
                radius="full"
                className="text-lg px-10 font-semibold"
                startContent={<GithubIcon size={20} />}
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
