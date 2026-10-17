"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LANGUAGE_NAMES, type Language } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { Flag } from "./flag";
import { LANGUAGE_FLAGS } from "./flags";
import { LanguageOptions, type LanguageOptionsProps } from "./language-options";

export interface LanguageSelectProps extends Pick<LanguageOptionsProps, "value" | "available" | "unavailableHint" | "currency"> {
  /** Called with the new language; the popover closes first. */
  onChange: (language: Language) => void;
  /** `field`: bordered button like the other settings; `link`: small text link (flag + name) for footers. */
  variant?: "field" | "link";
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Language chooser: a button showing the current flag and language that opens the list of languages with a preview of
 * dates and amounts (a popover on desktop, a bottom sheet on the phone).
 */
export function LanguageSelect({ value, onChange, variant = "field", disabled = false, id, className, ...options }: LanguageSelectProps) {
  const { t: tr } = useLocalization();
  const [open, setOpen] = React.useState(false);
  const title = tr("Lingua");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-label={`${title}: ${LANGUAGE_NAMES[value]}`}
        className={cn(
          variant === "field"
            ? "flex h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-56 dark:bg-input/30"
            : "inline-flex items-center gap-1.5 rounded-md outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Flag code={LANGUAGE_FLAGS[value]} size={variant === "link" ? "sm" : "md"} />
        <span className={variant === "field" ? "flex-1 text-left" : undefined}>{LANGUAGE_NAMES[value]}</span>
        {variant === "field" ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
      </PopoverTrigger>
      <PopoverContent align="end" side={variant === "link" ? "top" : "bottom"} className="w-80">
        <p className="px-3 pt-1 font-heading text-base font-medium text-foreground">{title}</p>
        <LanguageOptions
          {...options}
          value={value}
          label={title}
          onSelect={(language) => {
            setOpen(false);
            onChange(language);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
