"use client";
import { motion } from "motion/react";
import React from "react";

interface LoaderOneProps {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

export const LoaderOne = ({ title, subtitle, size = "md" }: LoaderOneProps) => {
  // Minimal, purposeful animation
  const pulseTransition = {
    duration: 1.8,
    repeat: Infinity,
    repeatType: "loop" as const,
    ease: [0.4, 0, 0.6, 1], // Subtle easing
  };

  const sizeConfig = {
    sm: { width: 56, height: 56, thickness: 2 },
    md: { width: 72, height: 72, thickness: 3 },
    lg: { width: 96, height: 96, thickness: 4 },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Minimal spinner */}
      <div className="relative" style={{ width: config.width, height: config.height }}>
        {/* Background ring */}
        <div 
          className="absolute inset-0 rounded-full border border-default-200"
          style={{ borderWidth: config.thickness }}
        />
        
        {/* Animated arc */}
        <motion.div
          className="absolute inset-0 rounded-full border-transparent"
          style={{
            borderWidth: config.thickness,
            borderTopColor: "#F4BA41", // Primary brand color
            borderRightColor: "rgba(244, 186, 65, 0.3)",
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
        
        {/* Center logo */}
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{
            width: config.width * 0.5,
            height: config.height * 0.5,
          }}
          animate={{
            scale: [0.9, 1, 0.9],
            opacity: [0.8, 1, 0.8],
          }}
          transition={pulseTransition}
        >
          <div
            className="w-full h-full bg-no-repeat bg-center bg-contain"
            style={{
              backgroundImage: "url('/favicon.svg')",
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
            }}
          />
        </motion.div>
      </div>

      {/* Typography */}
      {(title || subtitle) && (
        <div className="text-center space-y-1">
          {title && (
            <motion.h3 
              className="text-sm font-medium text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {title}
            </motion.h3>
          )}
          {subtitle && (
            <p className="text-xs text-default-400 max-w-[200px] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};