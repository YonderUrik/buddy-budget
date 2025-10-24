"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface TextRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function TextReveal({
  children,
  className,
  delay = 0,
}: TextRevealProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("", className)}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function TextRevealByWord({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const words = text.split(" ");

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {words.map((word, idx) => (
        <motion.span
          key={idx}
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 10 }}
          transition={{
            duration: 0.5,
            delay: idx * 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}
