"use client";

/**
 * Testo che entra parola per parola emergendo dalla sfocatura. Idea di Text Animate di Magic UI e Text Effect di
 * Motion Primitives (MIT). Il testo intero resta leggibile dal lettore di schermo; con il movimento ridotto compare
 * subito (lo gestisce `MotionConfig reducedMotion="user"` di `MotionProvider`).
 */

import { motion, type Variants } from "motion/react";
import type { ElementType } from "react";

export interface BlurTextProps {
  children: string;
  /** Elemento da usare (default `span`); per un titolo passare `h1`/`h2`. */
  as?: ElementType;
  className?: string;
  /** Ritardo tra una parola e la successiva, in secondi. */
  stagger?: number;
  /** Ritardo prima della prima parola, in secondi. */
  delay?: number;
}

const WORD_VARIANTS: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 10 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

export function BlurText({ children, as: Tag = "span", className, stagger = 0.06, delay = 0 }: BlurTextProps) {
  const words = children.split(" ");
  return (
    <Tag className={className} aria-label={children}>
      <motion.span
        aria-hidden="true"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
        className="contents"
      >
        {words.map((word, index) => (
          <motion.span key={index} variants={WORD_VARIANTS} className="inline-block whitespace-pre">
            {index < words.length - 1 ? `${word} ` : word}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  );
}
