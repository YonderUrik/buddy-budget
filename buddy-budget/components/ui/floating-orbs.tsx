"use client";

import { motion } from "framer-motion";

export function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Orb 1 - Large purple */}
      <motion.div
        className="absolute w-96 h-96 rounded-full bg-gradient-to-r from-violet-500/20 to-purple-500/20 blur-3xl"
        animate={{
          x: [0, 100, 0],
          y: [0, -100, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          top: "10%",
          left: "10%",
        }}
      />

      {/* Orb 2 - Medium blue */}
      <motion.div
        className="absolute w-72 h-72 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-3xl"
        animate={{
          x: [0, -80, 0],
          y: [0, 80, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          top: "50%",
          right: "10%",
        }}
      />

      {/* Orb 3 - Small green */}
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 blur-3xl"
        animate={{
          x: [0, 60, 0],
          y: [0, -60, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          bottom: "20%",
          left: "20%",
        }}
      />

      {/* Orb 4 - Medium pink */}
      <motion.div
        className="absolute w-80 h-80 rounded-full bg-gradient-to-r from-pink-500/20 to-rose-500/20 blur-3xl"
        animate={{
          x: [0, -70, 0],
          y: [0, 70, 0],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          top: "60%",
          left: "50%",
        }}
      />
    </div>
  );
}
