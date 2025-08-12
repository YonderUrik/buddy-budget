"use client";

import { motion } from "framer-motion";

const logos = [
  { name: "Acme", letter: "A" },
  { name: "Globex", letter: "G" },
  { name: "Umbrella", letter: "U" },
  { name: "Initech", letter: "I" },
  { name: "Hooli", letter: "H" },
];

export function TrustedBySection() {
  return (
    <section className="py-10">
      <div className="container mx-auto max-w-7xl px-6">
        <motion.div
          className="mx-auto grid max-w-4xl grid-cols-2 items-center gap-6 opacity-80 sm:grid-cols-3 md:grid-cols-5"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
        >
          {logos.map((l) => (
            <motion.div
              key={l.name}
              className="flex items-center justify-center rounded-large border border-default-100/60 bg-background/60 px-4 py-3 text-sm font-semibold"
              initial={{ opacity: 0, y: 10 }}
              variants={{ visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-default-100 text-foreground/70">
                {l.letter}
              </span>
              {l.name}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


