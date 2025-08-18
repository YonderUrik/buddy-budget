"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";

const CheckIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={cn("w-6 h-6", className)}
    >
      <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
};

const CheckFilled = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-6 h-6", className)}
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        clipRule="evenodd"
      />
    </svg>
  );
};

const LoadingIcon = ({ className }: { className?: string }) => {
  return (
    <div className={cn("w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin", className)} />
  );
};

type LoadingState = {
  text: string;
  icon?: React.ReactNode;
};

const LoaderCore = ({
  loadingStates,
  value = 0,
}: {
  loadingStates: LoadingState[];
  value?: number;
}) => {
  return (
    <div className="flex relative justify-start max-w-xl mx-auto flex-col mt-20">
      {loadingStates.map((loadingState, index) => {
        const distance = Math.abs(index - value);
        const opacity = Math.max(1 - distance * 0.2, 0);

        return (
          <motion.div
            key={index}
            className={cn("text-left flex gap-3 mb-4 items-center")}
            initial={{ opacity: 0, y: -(value * 40) }}
            animate={{ opacity: opacity, y: -(value * 40) }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex-shrink-0">
              {index > value && (
                <CheckIcon className="text-default-400 dark:text-default-500" />
              )}
              {index < value && (
                <CheckFilled className="text-green-500 dark:text-green-400" />
              )}
              {index === value && (
                <LoadingIcon className="text-primary" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-1">
              {loadingState.icon && (
                <span className={cn(
                  "text-lg",
                  value === index ? "opacity-100" : "opacity-60"
                )}>
                  {loadingState.icon}
                </span>
              )}
              <span
                className={cn(
                  "text-foreground font-medium",
                  value === index ? "text-primary opacity-100" : "opacity-60"
                )}
              >
                {loadingState.text}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export const MultiStepLoader = ({
  loadingStates,
  loading,
  duration = 2000,
  loop = false,
  onComplete,
}: {
  loadingStates: LoadingState[];
  loading?: boolean;
  duration?: number;
  loop?: boolean;
  onComplete?: () => void;
}) => {
  const [currentState, setCurrentState] = useState(0);

  useEffect(() => {
    if (!loading) {
      setCurrentState(0);
      return;
    }

    const timeout = setTimeout(() => {
      setCurrentState((prevState) => {
        const nextState = loop
          ? prevState === loadingStates.length - 1
            ? 0
            : prevState + 1
          : Math.min(prevState + 1, loadingStates.length - 1);
        
        // Call onComplete when we reach the last step
        if (nextState === loadingStates.length - 1 && !loop && onComplete) {
          setTimeout(onComplete, duration * 0.5); // Call after half the duration to show the final step
        }
        
        return nextState;
      });
    }, duration);

    return () => clearTimeout(timeout);
  }, [currentState, loading, loop, loadingStates.length, duration, onComplete]);

  return (
    <AnimatePresence mode="wait">
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full h-full fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-2xl bg-background/80"
        >
          <div className="h-96 relative">
            <LoaderCore value={currentState} loadingStates={loadingStates} />
          </div>

          <div className="bg-gradient-to-t inset-x-0 z-20 bottom-0 bg-background h-full absolute [mask-image:radial-gradient(900px_at_center,transparent_30%,white)] dark:[mask-image:radial-gradient(900px_at_center,transparent_30%,black)]" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export type { LoadingState };
