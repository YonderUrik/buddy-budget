"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { motion } from "framer-motion";
import { FcGoogle } from "react-icons/fc";
import { FaApple, FaGithub } from "react-icons/fa";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";

type Provider = "google" | "github" | "apple";

export default function SignInPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // Redirect authenticated users
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const { onboardingCompleted, onboardingStep } = session.user;

      if (onboardingCompleted) {
        router.push("/dashboard");
      } else {
        // Redirect to appropriate onboarding step
        const onboardingRoutes: Record<OnboardingStep, string> = {
          [OnboardingStep.NOT_STARTED]: "/onboarding/welcome",
          [OnboardingStep.WELCOME]: "/onboarding/welcome",
          [OnboardingStep.USER_PROFILE]: "/onboarding/user-profile",
          [OnboardingStep.INITIAL_NET_WORTH]: "/onboarding/initial-net-worth",
          [OnboardingStep.PREFERENCES]: "/onboarding/preferences",
          [OnboardingStep.COMPLETED]: "/dashboard",
        };

        router.push(onboardingRoutes[onboardingStep]);
      }
    }
  }, [status, session, router]);

  const handleSignIn = async (provider: Provider) => {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl });
    // Note: setLoadingProvider won't be called if redirect happens
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 25;
    const y = (e.clientY - rect.top - rect.height / 2) / 25;

    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePosition({ x: 0, y: 0 });
  };

  // Show loading state while checking authentication
  if (status === "loading") {
    return null;
  }

  // Don't render signin form if already authenticated (will redirect)
  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={title({ size: "lg" })}>
          <span className="bg-gradient-to-r from-brand-gold-500 to-brand-gold-500 bg-clip-text text-transparent">
            Welcome
          </span>
        </h1>
        <p className={subtitle({ class: "mt-4" })}>
          Sign in to start managing your finances with confidence
        </p>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        style={{ perspective: "1000px" }}
        transition={{ duration: 0.5, delay: 0.2 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        <motion.div
          animate={{
            rotateY: isHovered ? mousePosition.x : 0,
            rotateX: isHovered ? -mousePosition.y : 0,
          }}
          style={{ transformStyle: "preserve-3d" }}
          transition={{ duration: 0.2, ease: "linear" }}
        >
          <Card className="bg-default-50/10 dark:bg-default-50/10 backdrop-blur-md border border-brand-blue-500/20 shadow-xl">
            <CardBody className="p-8">
              <div className="flex flex-col gap-4">
                <motion.div
                  animate={{
                    translateZ: isHovered ? 20 : 0,
                  }}
                  style={{ transformStyle: "preserve-3d" }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02, translateZ: 30 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    className="w-full justify-start text-lg hover:border-brand-blue-500/40 hover:bg-default-100/50 transition-all duration-300"
                    isDisabled={loadingProvider !== null}
                    isLoading={loadingProvider === "google"}
                    size="lg"
                    startContent={<FcGoogle size={24} />}
                    variant="bordered"
                    onPress={() => handleSignIn("google")}
                  >
                    Continue with Google
                  </Button>
                </motion.div>

                <motion.div
                  animate={{
                    translateZ: isHovered ? 20 : 0,
                  }}
                  style={{ transformStyle: "preserve-3d" }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02, translateZ: 30 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    className="w-full justify-start text-lg hover:border-brand-blue-500/40 hover:bg-default-100/50 transition-all duration-300"
                    isDisabled={loadingProvider !== null}
                    isLoading={loadingProvider === "github"}
                    size="lg"
                    startContent={<FaGithub size={24} />}
                    variant="bordered"
                    onPress={() => handleSignIn("github")}
                  >
                    Continue with GitHub
                  </Button>
                </motion.div>

                <motion.div
                  animate={{
                    translateZ: isHovered ? 20 : 0,
                  }}
                  style={{ transformStyle: "preserve-3d" }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02, translateZ: 30 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    className="w-full justify-start text-lg hover:border-brand-blue-500/40 hover:bg-default-100/50 transition-all duration-300"
                    isDisabled={loadingProvider !== null}
                    isLoading={loadingProvider === "apple"}
                    size="lg"
                    startContent={<FaApple size={24} />}
                    variant="bordered"
                    onPress={() => handleSignIn("apple")}
                  >
                    Continue with Apple
                  </Button>
                </motion.div>
              </div>

              <p className="text-sm text-default-500 text-center mt-6">
                By signing in, you agree to our{" "}
                <a
                  className="text-brand-blue-500 hover:underline"
                  href="/terms"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  className="text-brand-blue-500 hover:underline"
                  href="/privacy"
                >
                  Privacy Policy
                </a>
              </p>
            </CardBody>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
