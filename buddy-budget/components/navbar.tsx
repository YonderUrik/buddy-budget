"use client";

import { useState } from "react";
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

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <motion.nav
        initial={false}
        animate={{
          width: "95%",
          maxWidth: "1200px"
        }}
        transition={{
          duration: 0.4,
          ease: [0.25, 0.1, 0.25, 1],
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className="relative"
      >
        <div className="bg-background/20 backdrop-blur-lg border border-default-200 dark:border-default-100 rounded-2xl shadow-lg">
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between px-6 py-3">
            {/* Logo */}
            <NextLink href="/" className="flex items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: 1,
                }}
                transition={{
                  duration: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                <Image
                  src={theme === "dark" ? "/logo/logo-text-dark.png" : "/logo/logo-text-light.png"}
                  alt="Buddy Budget Logo"
                  width={9064}
                  height={1933}
                  className="h-8 w-auto"
                  priority
                />
              </motion.div>
            </NextLink>

            {/* Navigation Items */}
            <div className="flex items-center gap-8">
              {siteConfig.navItems.map((item) => (
                <NextLink
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
                >
                  {item.label}
                </NextLink>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
              <a
                href={siteConfig.links.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Github"
                className="text-default-500 hover:text-default-900 dark:hover:text-default-100 transition-colors"
              >
                <GithubIcon size={20} />
              </a>
              <a
                href={siteConfig.links.sponsor}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Sponsor"
                className="text-danger hover:opacity-80 transition-opacity"
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
              <NextLink href="/" className="flex items-center">
                <Image
                  src={theme === "dark" ? "/logo/logo-text-dark.png" : "/logo/logo-text-light.png"}
                  alt="Buddy Budget Logo"
                  width={9064}
                  height={1933}
                  className="h-7 w-auto"
                  priority
                />
              </NextLink>

              {/* Mobile Right Side */}
              <div className="flex items-center gap-2">
                <a
                  href={siteConfig.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Github"
                  className="text-default-500 hover:text-default-900 dark:hover:text-default-100 transition-colors"
                >
                  <GithubIcon size={20} />
                </a>
                <a
                  href={siteConfig.links.sponsor}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Sponsor"
                  className="text-danger hover:opacity-80 transition-opacity"
                >
                  <HeartFilledIcon size={20} />
                </a>
                <ThemeSwitch />
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-foreground hover:bg-default-100 rounded-lg transition-colors"
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-default-200 dark:border-default-100"
                >
                  <div className="px-4 py-4 space-y-3">
                    {siteConfig.navItems.map((item) => (
                      <NextLink
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block text-sm font-medium text-foreground/80 hover:text-foreground transition-colors py-2"
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
