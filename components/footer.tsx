import React from "react";
import { Link } from "@heroui/link";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { GithubIcon, Logo } from "@/components/icons";
import type { Dictionary } from "@/types/dictionary";

export function Footer({ dict, locale }: { dict?: Dictionary; locale?: string }) {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-default-100/70 bg-transparent">
      <div className="container mx-auto max-w-7xl px-6 py-6 md:py-8">
        <div className="flex flex-col items-center gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          {/* Brand + tagline */}
          <div className="flex items-center gap-3">
            <div className="bg-default-foreground text-background rounded-full">
              <Logo size={30} />
            </div>
            <div className="flex flex-col text-center md:text-left">
              <span className="text-xs text-foreground-500">
                © {year} {siteConfig.name}
              </span>
            </div>
          </div>

          {/* Actions: theme switch and social */}
          <div className="flex items-center justify-center gap-4 md:justify-end">
            <ThemeSwitch />
            <Link
              aria-label="GitHub Repository"
              href={siteConfig.links.github}
              className="grid h-9 w-9 place-items-center rounded-full border border-default-200 text-foreground/80 transition-colors hover:bg-default-100 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              <GithubIcon size={18} />
            </Link>
            {dict?.legal && (
              <div className="flex items-center gap-3 ml-2 text-sm">
                <Link
                  href={`/${locale ?? "en"}/legal/terms`}
                  className="text-foreground-500 hover:text-foreground"
                >
                  {dict.legal.nav.terms}
                </Link>
                <span className="text-default-300">·</span>
                <Link
                  href={`/${locale ?? "en"}/legal/privacy`}
                  className="text-foreground-500 hover:text-foreground"
                >
                  {dict.legal.nav.privacy}
                </Link>
                <span className="text-default-300">·</span>
                <Link
                  href={`/${locale ?? "en"}/legal/cookies`}
                  className="text-foreground-500 hover:text-foreground"
                >
                  {dict.legal.nav.cookies ?? "Cookie Policy"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}


