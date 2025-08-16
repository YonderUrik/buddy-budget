"use client";
import { motion } from "motion/react";
import React from "react";

interface LoaderOneProps {
  title?: string;
  subtitle?: string;
}
 
export const LoaderOne = ({ title, subtitle }: LoaderOneProps) => {
  const transition = (x: number) => {
    return {
      duration: 1,
      repeat: Infinity,
      repeatType: "loop" as const,
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex flex-col items-center gap-4">
      {(title || subtitle) && (
        <div className="text-center">
          {title && (
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-default-500">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <motion.div
          initial={{
            y: 0,
          }}
          animate={{
            y: [0, 10, 0],
          }}
          transition={transition(0) as any}
          className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
        />
        <motion.div
          initial={{
            y: 0,
          }}
          animate={{
            y: [0, 10, 0],
          }}
          transition={transition(1) as any}
          className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
        />
        <motion.div
          initial={{
            y: 0,
          }}
          animate={{
            y: [0, 10, 0],
          }}
          transition={transition(2) as any}
          className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
        />
      </div>
    </div>
  );
};