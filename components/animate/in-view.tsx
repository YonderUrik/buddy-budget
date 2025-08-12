"use client";

import { PropsWithChildren } from "react";
import { motion, MotionProps } from "framer-motion";

type InViewFadeUpProps = PropsWithChildren<
  {
    delay?: number;
    y?: number;
    as?: keyof JSX.IntrinsicElements;
    className?: string;
  } & MotionProps
>;

export function InViewFadeUp({
  children,
  delay = 0,
  y = 16,
  as = "div",
  className,
  ...rest
}: InViewFadeUpProps) {
  const Component = motion[as as keyof typeof motion] as any;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: "easeOut", delay }}
      {...rest}
    >
      {children}
    </Component>
  );
}


