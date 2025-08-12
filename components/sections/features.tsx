"use client";

import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Dictionary } from "@/types/dictionary";

export function FeaturesSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="features" className="scroll-mt-20 py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <motion.div
          className="mx-auto mb-10 max-w-2xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center rounded-full border border-default-200 bg-background/60 px-3 py-1 text-xs text-secondary-500">
            {dict.landing.features.kicker}
          </span>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{dict.landing.features.heading}</h2>
          <p className="mt-3 text-foreground-500">{dict.landing.features.description}</p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {dict.landing.features.items.map((f, idx) => (
            <motion.div
              key={f.title}
              className="rounded-large border border-default-100/60 bg-background/70 p-5 backdrop-blur-sm"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon icon={idx % 2 === 0 ? "solar:chart-2-linear" : "solar:wallet-linear"} width={20} height={20} />
              </div>
              <h3 className="pb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-foreground-500">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


