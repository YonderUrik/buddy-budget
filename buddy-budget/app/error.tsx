"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";

import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const [glitchActive, setGlitchActive] = useState(false);
  const [konami, setKonami] = useState<string[]>([]);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    console.error(error);

    // Initial glitch effect
    const glitchTimer = setTimeout(() => setGlitchActive(true), 100);
    const glitchOffTimer = setTimeout(() => setGlitchActive(false), 600);

    return () => {
      clearTimeout(glitchTimer);
      clearTimeout(glitchOffTimer);
    };
  }, [error]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Easter egg: Type "debug" to reveal secret
      const newKonami = [...konami, e.key].slice(-5);

      setKonami(newKonami);

      if (newKonami.join("") === "debug") {
        setShowSecret(true);
      }
    };

    window.addEventListener("keypress", handleKeyPress);

    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [konami]);

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden bg-background dark:bg-black text-foreground">
      <BackgroundGradientAnimation>
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-background dark:via-black to-secondary/5" />

        {/* Main content */}
        <div className="relative z-10 mt-20 flex items-center justify-center h-full px-6 py-12 overflow-y-auto">
          <div className="max-w-3xl w-full space-y-12 animate-fade-slide-up">
            {/* Error code with glitch effect */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
                <div
                  className={`text-sm font-mono tracking-widest text-foreground/40 ${glitchActive ? "animate-glitch" : ""}`}
                >
                  ERROR
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
              </div>
            </div>

            {/* Main heading */}
            <div className="space-y-6">
              <h1
                className={`text-6xl md:text-8xl font-bold tracking-tight bg-gradient-to-r from-foreground via-primary to-secondary bg-clip-text text-transparent ${glitchActive ? "animate-glitch-text" : ""}`}
              >
                Something
                <br />
                broke
              </h1>

              <p className="text-xl md:text-2xl text-foreground/60 max-w-xl leading-relaxed font-light">
                {showSecret
                  ? "Impressive. You found the debug key. Here's what happened:"
                  : "An unexpected error interrupted your experience. Let's get you back on track."}
              </p>
            </div>

            {/* Error message box */}
            <div className="group relative">
              {/* Glow effect on hover */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-secondary rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-500" />

              <div className="relative bg-content1/50 backdrop-blur-xl border border-divider rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-danger/80" />
                    <div className="w-3 h-3 rounded-full bg-warning/80" />
                    <div className="w-3 h-3 rounded-full bg-success/80" />
                  </div>
                  <span className="text-xs font-mono text-foreground/40">
                    error.log
                  </span>
                </div>

                <div className="font-mono text-sm text-danger leading-relaxed">
                  {error.message || "An unexpected error occurred"}
                </div>

                {/* Stack trace - only in dev */}
                {showSecret &&
                  process.env.NODE_ENV === "development" &&
                  error.stack && (
                    <details className="group/details">
                      <summary className="cursor-pointer text-xs font-mono text-foreground/40 hover:text-foreground/60 transition-colors flex items-center gap-2">
                        <span className="transform transition-transform group-open/details:rotate-90">
                          ▶
                        </span>
                        stack_trace.txt
                      </summary>
                      <pre className="mt-3 text-xs text-foreground/40 overflow-x-auto whitespace-pre-wrap break-words">
                        {error.stack}
                      </pre>
                    </details>
                  )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                className="font-medium px-8"
                color="primary"
                size="lg"
                variant="shadow"
                onPress={reset}
              >
                Try again
              </Button>
              <Button
                as="a"
                className="font-medium px-8"
                color="secondary"
                href="/"
                size="lg"
                variant="bordered"
              >
                Return home
              </Button>
            </div>

            {/* Hint for easter egg */}
            {!showSecret && (
              <div className="text-center">
                <p className="text-xs font-mono text-foreground/20 animate-pulse-slow">
                  Hint: Try typing &quot;debug&quot;
                </p>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes fade-slide-up {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes glitch {
            0%,
            100% {
              transform: translate(0);
            }
            20% {
              transform: translate(-2px, 2px);
            }
            40% {
              transform: translate(-2px, -2px);
            }
            60% {
              transform: translate(2px, 2px);
            }
            80% {
              transform: translate(2px, -2px);
            }
          }

          @keyframes glitch-text {
            0%,
            100% {
              text-shadow: 0 0 0 transparent;
            }
            25% {
              text-shadow:
                -2px 0 0 rgba(255, 0, 0, 0.5),
                2px 0 0 rgba(0, 255, 255, 0.5);
            }
            50% {
              text-shadow:
                2px 0 0 rgba(255, 0, 0, 0.5),
                -2px 0 0 rgba(0, 255, 255, 0.5);
            }
            75% {
              text-shadow:
                -2px 0 0 rgba(0, 255, 255, 0.5),
                2px 0 0 rgba(255, 0, 0, 0.5);
            }
          }

          @keyframes pulse-slow {
            0%,
            100% {
              opacity: 0.2;
            }
            50% {
              opacity: 0.4;
            }
          }

          .animate-fade-slide-up {
            animation: fade-slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .animate-glitch {
            animation: glitch 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
          }

          .animate-glitch-text {
            animation: glitch-text 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)
              infinite;
          }

          .animate-pulse-slow {
            animation: pulse-slow 3s ease-in-out infinite;
          }

          @keyframes float-shape {
            0%,
            100% {
              transform: translate(0, 0) rotate(0deg);
              opacity: 0.3;
            }
            25% {
              transform: translate(30px, -30px) rotate(90deg);
              opacity: 0.5;
            }
            50% {
              transform: translate(-20px, -60px) rotate(180deg);
              opacity: 0.2;
            }
            75% {
              transform: translate(-40px, -30px) rotate(270deg);
              opacity: 0.4;
            }
          }

          @keyframes float-shape-reverse {
            0%,
            100% {
              transform: translate(0, 0) rotate(0deg);
              opacity: 0.2;
            }
            25% {
              transform: translate(-30px, 30px) rotate(-90deg);
              opacity: 0.4;
            }
            50% {
              transform: translate(20px, 60px) rotate(-180deg);
              opacity: 0.1;
            }
            75% {
              transform: translate(40px, 30px) rotate(-270deg);
              opacity: 0.3;
            }
          }

          @keyframes float-line {
            0%,
            100% {
              transform: translateX(0) translateY(0);
              opacity: 0;
            }
            10% {
              opacity: 0.3;
            }
            50% {
              transform: translateX(100px) translateY(-50px);
              opacity: 0.5;
            }
            90% {
              opacity: 0.3;
            }
          }

          .animate-float-shape {
            animation: float-shape infinite ease-in-out;
          }

          .animate-float-shape-reverse {
            animation: float-shape-reverse infinite ease-in-out;
          }

          .animate-float-line {
            animation: float-line infinite ease-in-out;
          }
        `}</style>
      </BackgroundGradientAnimation>
    </div>
  );
}
