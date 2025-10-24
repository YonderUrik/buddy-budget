"use client";

import { motion } from "framer-motion";
import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

import { title, subtitle } from "@/components/primitives";
import { siteConfig } from "@/config/site";
import {
  GithubIcon,
  HeartFilledIcon,
  ChartIcon,
  TrendingIcon,
  TargetIcon,
  PiggyBankIcon,
  WalletIcon,
} from "@/components/icons";
import { TextReveal } from "@/components/ui/text-reveal";
import {
  FeatureSection,
  FeatureCard,
  LargeFeatureCard,
} from "@/components/ui/feature-section";

export default function AboutPage() {
  const technologies = [
    { name: "Next.js 15", category: "Framework" },
    { name: "React 19", category: "UI Library" },
    { name: "TypeScript", category: "Language" },
    { name: "Tailwind CSS", category: "Styling" },
    { name: "HeroUI", category: "Component Library" },
    { name: "Framer Motion", category: "Animations" },
    { name: "Python", category: "Backend" },
    { name: "Monte Carlo Simulations", category: "Financial Modeling" },
    { name: "Yahoo Finance API", category: "Market Data" },
  ];

  const timeline = [
    {
      year: "2024",
      title: "Project Birth",
      description:
        "Buddy Budget was born from a personal need to track and grow net worth with transparency, powerful predictions, and comprehensive asset management.",
    },
    {
      year: "2025",
      title: "Open Source Launch",
      description:
        "Released as open source to help everyone track and grow their net worth with accessible, transparent tools and accurate predictions.",
    },
    {
      year: "Future",
      title: "Growing Together",
      description:
        "Building a community-driven platform with comprehensive net worth management features requested by users who want to build wealth.",
    },
  ];

  const values = [
    {
      title: "Powerful",
      description:
        "Advanced financial modeling with Monte Carlo simulations and real-time market data integration.",
      emoji: "⚡",
      gradient: "from-brand-blue-400 to-brand-blue-600",
    },
    {
      title: "Ready to Use",
      description:
        "Cloud-hosted and ready to go. No setup, no installation—just sign up and start tracking your net worth.",
      emoji: "🚀",
      gradient: "from-brand-gold-400 to-brand-gold-600",
    },
    {
      title: "Accessible",
      description:
        "Net worth tracking tools should be available to everyone, not just those who can afford expensive software.",
      emoji: "🌍",
      gradient: "from-brand-blue-500 to-brand-gold-500",
    },
    {
      title: "Community Driven",
      description:
        "Built by the community, for the community. Every feature and improvement comes from real user needs.",
      emoji: "🤝",
      gradient: "from-brand-gold-500 to-brand-blue-500",
    },
  ];

  return (
    <div className="flex flex-col gap-20 py-8 md:py-12 relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center gap-8 text-center px-4 min-h-[60vh]">
        <TextReveal delay={0}>
          <h1 className={title({ size: "lg" })}>
            About{" "}
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              Buddy Budget
            </span>
          </h1>
        </TextReveal>

        <TextReveal delay={0.1}>
          <p className={subtitle({ class: "mt-4 max-w-3xl mx-auto" })}>
            A cloud-hosted net worth tracking and management platform built with
            passion and the belief that everyone deserves access to powerful,
            ready-to-use financial tools.
          </p>
        </TextReveal>
      </section>

      {/* Mission Section */}
      <section className="relative flex flex-col items-center gap-8 px-4">
        <motion.div
          className="max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-12">
            <h2 className={title({ size: "md" })}>
              The{" "}
              <span className={title({ color: "blue", size: "md" })}>
                Mission
              </span>
            </h2>
          </div>

          <Card className="bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 border border-brand-blue-500/20 dark:border-brand-blue-400/20">
            <CardBody className="p-8 md:p-12">
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300 mb-6">
                Buddy Budget was created with a singular focus: to provide
                comprehensive, ready-to-use tools for tracking and managing your
                net worth. Too often, powerful net worth tracking tools are
                locked behind expensive paywalls or require complex setup. I
                believe that understanding and growing your net worth should be
                simple, accessible, and powerful.
              </p>
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300 mb-6">
                This cloud-hosted platform combines advanced financial modeling
                techniques—including Monte Carlo simulations for net worth
                predictions, real-time asset tracking with Yahoo Finance, and
                comprehensive portfolio management—with modern web technologies
                to create an intuitive, powerful net worth companion that&apos;s
                ready to use right out of the box.
              </p>
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300">
                Track your assets, monitor your investments, predict your future
                net worth—all with institutional-grade tools in a simple,
                accessible platform. No installation, no setup, just powerful
                net worth tracking. That&apos;s the Buddy Budget promise.
              </p>
            </CardBody>
          </Card>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="relative flex flex-col items-center gap-12 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            Powerful{" "}
            <span className={title({ color: "blue", size: "md" })}>
              Features
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            Everything you need to track and grow your net worth
          </p>
        </motion.div>

        <FeatureSection className="w-full">
          {/* Large Feature - Monte Carlo */}
          <LargeFeatureCard
            description="Leverage advanced statistical modeling to predict your future net worth with precision. Our Monte Carlo simulations run thousands of scenarios based on your income, expenses, and investment returns to give you a probabilistic view of your financial future. See the best case, worst case, and most likely outcomes for your wealth trajectory."
            icon={<ChartIcon className="text-brand-blue-500" size={40} />}
            image={
              <div className="relative w-full h-64 flex items-center justify-center">
                <div className="text-8xl">📊</div>
              </div>
            }
            title="Monte Carlo Net Worth Predictions"
          />

          {/* Regular Features */}
          <FeatureCard
            description="Monitor your portfolio with live market data powered by Yahoo Finance. Track stocks, ETFs, cryptocurrencies, and more with real-time price updates and performance analytics."
            icon={<TrendingIcon className="text-brand-gold-500" size={32} />}
            title="Real-Time Stock Tracking"
          />

          <FeatureCard
            description="Comprehensive insights into your investment performance. View asset allocation, historical returns, risk metrics, and detailed breakdowns of your entire portfolio."
            icon={<TargetIcon className="text-brand-blue-500" size={32} />}
            title="Portfolio Analytics"
          />

          <FeatureCard
            description="Visualize your complete financial picture in one place. Track assets, liabilities, and net worth over time with beautiful charts and interactive visualizations."
            icon={<WalletIcon className="text-brand-gold-500" size={32} />}
            title="Net Worth Dashboard"
          />

          {/* Large Feature - Coming Soon */}
          <LargeFeatureCard
            description="We're constantly working on new features to help you manage your wealth better. Expense tracking, budget management, savings goals, and AI-powered financial insights are all in development. Join our community to help shape the future of Buddy Budget."
            icon={<PiggyBankIcon className="text-brand-gold-500" size={40} />}
            image={
              <div className="relative w-full h-64 flex flex-col items-center justify-center gap-4">
                <div className="flex gap-4 text-5xl">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0 }}
                  >
                    🧾
                  </motion.div>
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                  >
                    💰
                  </motion.div>
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.6 }}
                  >
                    🎯
                  </motion.div>
                </div>
              </div>
            }
            title="More Features Coming Soon"
          />
        </FeatureSection>
      </section>

      {/* Core Values */}
      <section className="relative flex flex-col items-center gap-12 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            Core{" "}
            <span className={title({ color: "yellow", size: "md" })}>
              Values
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            The principles that guide every decision
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl w-full">
          {values.map((value, i) => (
            <motion.div
              key={i}
              className="group"
              initial={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 border border-brand-blue-500/20 dark:border-brand-blue-400/20 hover:border-brand-blue-500/40 dark:hover:border-brand-blue-400/40 transition-all">
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`text-4xl flex-shrink-0 p-3 rounded-xl bg-gradient-to-br ${value.gradient} shadow-lg`}
                    >
                      {value.emoji}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">{value.title}</h3>
                      <p className="text-default-600 dark:text-default-400">
                        {value.description}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="relative flex flex-col items-center gap-12 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            The{" "}
            <span className={title({ color: "blue", size: "md" })}>
              Journey
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            From idea to open-source reality
          </p>
        </motion.div>

        <div className="max-w-3xl w-full">
          {timeline.map((item, i) => (
            <motion.div
              key={i}
              className="relative pl-8 pb-12 last:pb-0"
              initial={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
              viewport={{ once: true }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              {/* Timeline line */}
              {i !== timeline.length - 1 && (
                <div className="absolute left-[11px] top-8 w-0.5 h-full bg-gradient-to-b from-brand-blue-500 to-brand-gold-500 opacity-30" />
              )}

              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-gradient-to-br from-brand-blue-500 to-brand-gold-500 shadow-lg" />

              <div className="bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 p-6 rounded-xl border border-brand-blue-500/20 dark:border-brand-blue-400/20">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-bold bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
                    {item.year}
                  </span>
                  <h3 className="text-xl font-bold">{item.title}</h3>
                </div>
                <p className="text-default-600 dark:text-default-400">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Technology Stack */}
      <section className="relative flex flex-col items-center gap-12 px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            Built with Modern{" "}
            <span className={title({ color: "yellow", size: "md" })}>
              Technology
            </span>
          </h2>
          <p className={subtitle({ class: "mt-2" })}>
            Cutting-edge tools for the best experience
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-3 justify-center max-w-4xl">
          {technologies.map((tech, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05, y: -2 }}
              whileInView={{ opacity: 1, scale: 1 }}
            >
              <Card className="bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 border border-brand-blue-500/20 dark:border-brand-blue-400/20 hover:border-brand-blue-500/40 dark:hover:border-brand-blue-400/40 transition-all">
                <CardBody className="px-4 py-2">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-semibold text-sm">{tech.name}</span>
                    <span className="text-xs text-default-500">
                      {tech.category}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* About the Creator */}
      <section className="relative flex flex-col items-center gap-8 px-4">
        <motion.div
          className="text-center max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <h2 className={title({ size: "md" })}>
            About the{" "}
            <span className={title({ color: "blue", size: "md" })}>
              Creator
            </span>
          </h2>
          <Card className="mt-8 bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 border border-brand-blue-500/20 dark:border-brand-blue-400/20">
            <CardBody className="p-8 md:p-12 text-left">
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300 mb-6">
                Hi, I&apos;m Daniele Roccaforte! I&apos;m a software developer
                based in Turin, Italy—a city known for its rich history,
                incredible coffee culture, and stunning views of the Alps. When
                I&apos;m not coding or hiking in the nearby mountains, I&apos;m
                diving deep into financial markets and building tools that help
                people take control of their wealth.
              </p>
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300 mb-6">
                Buddy Budget started as a personal challenge: I wanted to track
                my own net worth with precision, predict future growth using
                data science, and monitor my investments in real-time. After
                months of building features for myself, I realized this could
                help others who share the same frustration with expensive,
                complicated financial tools that require extensive setup.
              </p>
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300 mb-6">
                With a background in software engineering and a passion for
                financial independence, I combined modern web technologies with
                advanced statistical methods to create a cloud-hosted platform
                that&apos;s ready to use immediately. From Monte Carlo
                simulations that predict your financial future to real-time
                portfolio tracking powered by market APIs, every feature is
                designed with one goal: helping you understand exactly where
                your wealth is and where it&apos;s going.
              </p>
              <p className="text-lg leading-relaxed text-default-700 dark:text-default-300">
                I&apos;m a firm believer in open source and the power of
                community. Buddy Budget is my contribution to making
                wealth-building accessible to everyone, regardless of where you
                live or what you earn. Whether you&apos;re in Turin, Tokyo, or
                Texas, powerful net worth tracking should be just a click away.
                Let&apos;s build the future of net worth tracking together!
              </p>
            </CardBody>
          </Card>
        </motion.div>
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
          <h2 className={title({ size: "md" })}>Join the Journey</h2>
          <p className={subtitle({ class: "mt-4 mb-8 max-w-2xl" })}>
            Whether you&apos;re tracking your net worth with Buddy Budget or
            contributing to its development, you&apos;re part of a community
            building better wealth management tools for everyone.
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                isExternal
                as={Link}
                className="text-lg px-10 font-semibold"
                color="primary"
                href={siteConfig.links.github}
                radius="full"
                size="lg"
                startContent={<GithubIcon size={20} />}
                variant="shadow"
              >
                Star on GitHub
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                isExternal
                as={Link}
                className="text-lg px-10 font-semibold"
                color="secondary"
                href={siteConfig.links.contributing}
                radius="full"
                size="lg"
                startContent={<HeartFilledIcon size={20} />}
                variant="bordered"
              >
                Contribute
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
