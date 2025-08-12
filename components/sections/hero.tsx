"use client";

import { motion } from "framer-motion";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { siteConfig } from "@/config/site";
import { Dictionary } from "@/types/dictionary";

export function HeroSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="home" className="relative scroll-mt-20 overflow-hidden py-16 md:py-24">
      {/* Background gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, hsl(var(--heroui-secondary)) 0%, transparent 60%), radial-gradient(800px 300px at 90% 10%, hsl(var(--heroui-primary)) 0%, transparent 60%)",
        }}
      />

      <div className="container mx-auto max-w-7xl px-6">
        <motion.div
          className="mx-auto max-w-5xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            {dict.landing.hero.titleBefore}
            <span className="ml-2 bg-gradient-to-tr from-primary to-secondary bg-clip-text text-transparent">
              {siteConfig.name}
            </span>
          </h1>
          <motion.p
            className="mt-6 text-base text-foreground-500 md:text-lg"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.15, duration: 0.6 }}
          >
            {dict.landing.hero.description}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <Button
              as={Link}
              href="/auth"
              color="primary"
              radius="full"
              variant="shadow"
              className="px-6"
            >
              {dict.landing.hero.primaryCta}
            </Button>

           
          </motion.div>

          <motion.ul
            className="mt-4 flex flex-wrap items-center justify-center gap-2 text-foreground-500"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: 0.25, duration: 0.6 }}
          >
            {dict?.landing?.metrics?.items?.slice(0, 3)?.map((m) => (
              <li key={m.label} className="rounded-full border border-default-200 bg-background/60 px-3 py-1 text-xs">
                {m.label}
              </li>
            ))}
          </motion.ul>

          <motion.div
            className="pointer-events-none relative mx-auto mt-12 max-w-4xl"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="absolute inset-0 -z-10 blur-3xl" style={{
              background:
                "radial-gradient(700px 200px at 50% 0%, hsl(var(--heroui-primary)) 0%, transparent 70%)",
            }} />
            <img
              src="/hero-illustration.svg"
              alt="App preview"
              className="mx-auto w-full rounded-2xl border border-default-100/70 bg-background/50 shadow-large"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}


