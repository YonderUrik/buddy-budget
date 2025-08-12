"use client";

import { motion } from "framer-motion";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Dictionary } from "@/types/dictionary";

export function CTASection({ dict }: { dict: Dictionary }) {
  return (
    <section id="get-started" className="scroll-mt-20 py-16 md:py-24">
      <div className="container mx-auto max-w-7xl px-6">
        <motion.div
          className="relative overflow-hidden rounded-3xl border border-default-100/60 p-0 md:p-0"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Gradient background */}
          <div className="absolute inset-0 -z-10">
            <div
              className="absolute -inset-20 opacity-90"
              style={{
                background:
                  "radial-gradient(1200px 400px at 20% 0%, hsl(var(--heroui-primary)/.15) 0%, transparent 60%), radial-gradient(900px 300px at 100% 100%, hsl(var(--heroui-secondary)/.18) 0%, transparent 60%)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-background/60 via-background/40 to-background/60" />
          </div>

          <div className="relative grid gap-8 p-7 md:grid-cols-2 md:gap-6 md:p-10">
            {/* Left: copy & actions */}
            <div className="flex flex-col justify-center">
              <h3 className="text-3xl font-bold leading-tight md:text-4xl">
                {dict.landing.cta.heading}
              </h3>
              <p className="mt-3 text-base text-foreground-600 md:text-lg">
                {dict.landing.cta.description}
              </p>

              <motion.div
                className="mt-7 flex flex-col gap-3 sm:flex-row"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <Button
                  as={Link}
                  href="/auth"
                  color="primary"
                  radius="full"
                  variant="shadow"
                  className="h-11 px-8 transition-transform hover:-translate-y-0.5"
                >
                  {dict.landing.cta.primary}
                </Button>
              </motion.div>
            </div>

            {/* Right: visual */}
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="absolute -right-10 -top-10 -z-10 h-52 w-52 rounded-full bg-primary/20 blur-3xl md:h-64 md:w-64" />
              <motion.img
                src="/hero-illustration.svg"
                alt="Preview"
                className="mx-auto w-full max-w-md rounded-2xl border border-default-100/70 bg-background/70 shadow-large md:max-w-lg"
                whileHover={{ rotate: -0.5, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 250, damping: 18 }}
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}


