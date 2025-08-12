"use client";

import { motion } from "framer-motion";
import { Dictionary } from "@/types/dictionary";

export function HowItWorksSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="how-it-works" className="scroll-mt-20 py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <motion.div
          className="mx-auto mb-10 max-w-2xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center rounded-full border border-default-200 bg-background/60 px-3 py-1 text-xs text-secondary-500">
            {dict.landing.howItWorks.kicker}
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {dict.landing.howItWorks.heading}
          </h2>
        </motion.div>
        <motion.ol
          className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {dict.landing.howItWorks.steps.map((step, index) => (
            <motion.li
              key={step.title}
              className="rounded-large border border-default-100/60 bg-background/70 p-6"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-default-100 text-sm font-semibold">
                {index + 1}
              </div>
              <h3 className="text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-foreground-500">{step.desc}</p>
            </motion.li>
          ))}
        </motion.ol>
      </div>
    </section>
  );
}


