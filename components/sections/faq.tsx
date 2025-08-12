"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Dictionary } from "@/types/dictionary";

export function FAQSection({ dict }: { dict: Dictionary }) {
  return (
    <section id="faq" className="scroll-mt-20 py-14 md:py-20">
      <div className="container mx-auto max-w-7xl px-6">
        <motion.div
          className="mx-auto mb-10 max-w-2xl text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="inline-flex items-center rounded-full border border-default-200 bg-background/60 px-3 py-1 text-xs text-secondary-500">
            {dict.landing.faq.kicker}
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {dict.landing.faq.heading}
          </h2>
        </motion.div>
        <motion.div
          className="mx-auto max-w-3xl"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <dl className="divide-y divide-default-100/60 rounded-large border border-default-100/60 bg-background/60">
            {dict.landing.faq.items.map((item, idx) => (
              <Disclosure key={item.q} question={item.q} answer={item.a} defaultOpen={idx === 0} />
            ))}
          </dl>
        </motion.div>
      </div>
    </section>
  );
}

function Disclosure({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-semibold">{question}</span>
        <span className={`transition-transform ${open ? "rotate-180" : "rotate-0"}`}>⌄</span>
      </button>
      <div className={`overflow-hidden px-5 transition-[max-height,opacity] duration-300 ${open ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="pb-4 text-sm text-foreground-500">{answer}</p>
      </div>
      <div className="h-px w-full bg-default-100/60" />
    </div>
  );
}


