"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import NextLink from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Menu, X } from "lucide-react";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { GithubIcon, HeartFilledIcon } from "@/components/icons";

export const Navbar = () => {
  const { theme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.nav
        animate={{
          width: "95%",
          maxWidth: "1200px",
        }}
        className="relative"
        initial={false}
        transition={{
          duration: 0.4,
          ease: [0.25, 0.1, 0.25, 1],
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
      >
        <div className="bg-background/80 backdrop-blur-lg border border-brand-blue-500/20 dark:border-brand-blue-400/20 rounded-2xl shadow-lg shadow-brand-blue-500/5">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between px-6 py-3">
            {/* Logo */}
            <NextLink className="flex items-center" href="/">
              <motion.div
                animate={{
                  scale: 1,
                }}
                initial={false}
                transition={{
                  duration: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {mounted && (
                  <Image
                    priority
                    alt="Buddy Budget Logo"
                    className="h-8 w-auto"
                    height={1933}
                    src={
                      theme === "dark"
                        ? "/logo/logo-text-dark.png"
                        : "/logo/logo-text-light.png"
                    }
                    width={9064}
                  />
                )}
              </motion.div>
            </NextLink>

            {/* Navigation Items */}
            <div className="flex items-center gap-8">
              {siteConfig.navItems.map((item) => (
                <NextLink
                  key={item.href}
                  className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors relative group"
                  href={item.href}
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 transition-all group-hover:w-full" />
                </NextLink>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <a
                aria-label="Github"
                className="text-default-500 hover:text-default-900 dark:hover:text-default-100 transition-colors"
                href={siteConfig.links.github}
                rel="noopener noreferrer"
                target="_blank"
              >
                <GithubIcon size={20} />
              </a>
              <a
                aria-label="Sponsor"
                className="text-danger hover:opacity-80 transition-opacity"
                href={siteConfig.links.sponsor}
                rel="noopener noreferrer"
                target="_blank"
              >
                <HeartFilledIcon size={20} />
              </a>
              <ThemeSwitch />
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              {/* Mobile Logo */}
              <NextLink className="flex items-center" href="/">
                {mounted && (
                  <Image
                    priority
                    alt="Buddy Budget Logo"
                    className="h-7 w-auto"
                    height={1933}
                    src={
                      theme === "dark"
                        ? "/logo/logo-text-dark.png"
                        : "/logo/logo-text-light.png"
                    }
                    width={9064}
                  />
                )}
              </NextLink>

              {/* Mobile Right Side */}
              <div className="flex items-center gap-2">
                <a
                  aria-label="Github"
                  className="text-default-500 hover:text-default-900 dark:hover:text-default-100 transition-colors"
                  href={siteConfig.links.github}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <GithubIcon size={20} />
                </a>
                <a
                  aria-label="Sponsor"
                  className="text-danger hover:opacity-80 transition-opacity"
                  href={siteConfig.links.sponsor}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HeartFilledIcon size={20} />
                </a>
                <ThemeSwitch />
                <button
                  aria-label="Toggle menu"
                  className="p-2 text-foreground hover:bg-default-100 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden border-t border-brand-blue-500/20 dark:border-brand-blue-400/20"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="px-4 py-4 space-y-3">
                    {siteConfig.navItems.map((item) => (
                      <NextLink
                        key={item.href}
                        className="block text-sm font-medium text-foreground/80 hover:text-primary transition-colors py-2"
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {item.label}
                      </NextLink>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.nav>
    </div>
  );
};
