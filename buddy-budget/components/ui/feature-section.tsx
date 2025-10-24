"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const FeatureSection = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-6xl mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const FeatureCard = ({
  title,
  description,
  icon,
  className,
  gradient,
  image,
}: {
  title: string;
  description: string | React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  gradient?: string;
  image?: React.ReactNode;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -5 }}
      className={cn("relative group", className)}
    >
      <div className="relative h-full p-8 rounded-2xl border border-brand-blue-500/20 dark:border-brand-blue-400/20 bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 dark:to-transparent overflow-hidden backdrop-blur-sm hover:border-brand-blue-500/40 dark:hover:border-brand-blue-400/40 transition-all duration-300">
        {/* Gradient overlay on hover */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            gradient ||
              "bg-gradient-to-br from-brand-blue-500/5 via-transparent to-brand-gold-500/5"
          )}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {image && <div className="mb-4">{image}</div>}
          {icon && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-brand-blue-500/10 to-brand-gold-500/10 w-fit">
              {icon}
            </div>
          )}
          <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
            {title}
          </h3>
          <div className="text-default-600 dark:text-default-400 leading-relaxed">
            {description}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const LargeFeatureCard = ({
  title,
  description,
  icon,
  className,
  image,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
  image?: React.ReactNode;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={cn("lg:col-span-3", className)}
    >
      <div className="relative h-full p-8 md:p-12 rounded-2xl border border-brand-blue-500/20 dark:border-brand-blue-400/20 bg-gradient-to-br from-default-50 to-transparent dark:from-default-50/5 dark:to-transparent overflow-hidden backdrop-blur-sm">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-500/5 via-transparent to-brand-gold-500/5" />

        {/* Content */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            {icon && (
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-brand-blue-500/10 to-brand-gold-500/10 w-fit">
                {icon}
              </div>
            )}
            <h3 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
              {title}
            </h3>
            <p className="text-lg text-default-600 dark:text-default-400 leading-relaxed">
              {description}
            </p>
          </div>
          {image && <div className="flex items-center justify-center">{image}</div>}
        </div>
      </div>
    </motion.div>
  );
};
