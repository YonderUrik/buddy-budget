"use client";

import { motion } from "framer-motion";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { siteConfig } from "@/config/site";
import { Dictionary } from "@/types/dictionary";
import { CometCard } from "../ui/comet-card";

export function HeroSection({ dict }: { dict: Dictionary }) {
  return (
    <div className="relative mx-auto my-10 flex max-w-7xl flex-col items-center justify-center">
      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-neutral-200/60 dark:ring-neutral-800/60" />
      <div className="px-4 py-10 md:py-20">
        <h1 className="relative z-10 mx-auto max-w-4xl text-center text-2xl font-bold text-slate-700 md:text-4xl lg:text-7xl dark:text-slate-300">
          {`${dict.landing.hero.titleBefore} ${siteConfig.name}`
            .split(" ")
            .map((word, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, filter: "blur(4px)", y: 10 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.1,
                  ease: "easeInOut",
                }}
                className="mr-2 inline-block"
              >
                {word}
              </motion.span>
            ))}
        </h1>
        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.3,
            delay: 0.8,
          }}
          className="relative z-10 mx-auto max-w-xl py-4 text-center text-lg font-normal text-neutral-600 dark:text-neutral-400"
        >
          {dict.landing.hero.description}
        </motion.p>
        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.3,
            delay: 1,
          }}
          className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <Button
            as={Link}
            href="/auth"
            color="primary"
            radius="full"
            variant="shadow"
            className="px-6 mb-10"
          >
            {dict.landing.hero.primaryCta}
          </Button>
        </motion.div>
        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 1.2,
          }}
          // className="relative z-10 mt-20 rounded-3xl ring-1 ring-neutral-200/60 bg-neutral-100 p-4 shadow-md dark:ring-neutral-800/60 dark:bg-neutral-900"
        >
          <CometCard>
            <div className="w-full overflow-hidden rounded-xl">
              <img
                src="/hero-illustration.svg"
                alt="Landing page preview"
                className="aspect-[16/9] h-auto w-full object-cover"
                height={1000}
                width={1000}
              />
            </div>
          </CometCard>
        </motion.div>
      </div>
    </div>
  );
}


