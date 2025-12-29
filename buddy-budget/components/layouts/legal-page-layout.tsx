"use client";

import { motion } from "framer-motion";
import { Card, CardBody } from "@heroui/card";

import { title, subtitle } from "@/components/primitives";
import { TextReveal } from "@/components/ui/text-reveal";
import { MarkdownContent } from "@/components/markdown/markdown-content";

interface LegalPageLayoutProps {
  pageTitle: string;
  description: string;
  content: string;
}

export function LegalPageLayout({
  pageTitle,
  description,
  content,
}: LegalPageLayoutProps) {
  return (
    <div className="flex flex-col gap-16 py-8 md:py-12 relative overflow-hidden">
      {/* Hero Section - Animated like other pages */}
      <section className="relative flex flex-col items-center justify-center gap-6 text-center px-4">
        <TextReveal delay={0}>
          <h1 className={title({ size: "lg" })}>
            {pageTitle.split(" ").slice(0, -1).join(" ")}{" "}
            <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              {pageTitle.split(" ").slice(-1)}
            </span>
          </h1>
        </TextReveal>

        <TextReveal delay={0.1}>
          <p className={subtitle({ class: "mt-2 max-w-3xl mx-auto" })}>
            {description}
          </p>
        </TextReveal>
      </section>

      {/* Content Section */}
      <section className="relative flex flex-col items-center px-4">
        <motion.div
          className="w-full max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-default-50/90 dark:bg-black/60 border border-brand-blue-500/20 dark:border-brand-blue-400/20">
            <CardBody className="p-8 md:p-12">
              <MarkdownContent content={content} />
            </CardBody>
          </Card>
        </motion.div>
      </section>

      {/* Back to Top Section */}
      <section className="relative flex justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <button
            className="text-brand-blue-500 dark:text-brand-blue-400 hover:text-brand-blue-600 dark:hover:text-brand-blue-300 font-semibold transition-colors flex items-center gap-2"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <span>↑</span>
            <span>Back to Top</span>
          </button>
        </motion.div>
      </section>
    </div>
  );
}
