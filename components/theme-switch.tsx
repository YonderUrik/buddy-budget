"use client";

import { FC, useMemo } from "react";
import { Switch as HeroSwitch, SwitchProps } from "@heroui/switch";
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";
import clsx from "clsx";

import { SunIconModern, MoonIconModern } from "./icons";

export interface ThemeSwitchProps {
  className?: string;
  classNames?: SwitchProps["classNames"];
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({
  className,
  classNames,
}) => {
  const { theme, setTheme } = useTheme();
  const isSSR = useIsSSR();

  const onChange = () => {
    theme === "light" ? setTheme("dark") : setTheme("light");
  };

  const selectedIsLight = isSSR || theme === "light";

  const label = useMemo(
    () => `Switch to ${selectedIsLight ? "dark" : "light"} mode`,
    [selectedIsLight],
  );

  return (
    <HeroSwitch
      isSelected={selectedIsLight}
      onChange={onChange}
      aria-label={label}
      size="lg"
      className={clsx(
        "active:scale-[0.98] transition-transform",
        className,
        classNames?.base,
      )}
      classNames={{
        base: clsx(
          "inline-flex items-center cursor-pointer select-none",
          classNames?.base,
        ),
        wrapper: clsx(
          "h-8 w-14 rounded-full",
          "bg-gradient-to-tr from-default-200 to-default-300",
          "dark:from-zinc-800 dark:to-zinc-700",
          "border border-default-200 dark:border-zinc-600",
          "shadow-inner transition-all",
          classNames?.wrapper,
        ),
        thumb: clsx(
          "h-6 w-6",
          "bg-white dark:bg-zinc-900",
          "shadow-[0_3px_10px_rgba(0,0,0,0.15)] dark:shadow-[0_3px_10px_rgba(0,0,0,0.35)]",
          classNames?.thumb as string,
        ),
        startContent: clsx("text-amber-500", classNames?.startContent as string),
        endContent: clsx("text-blue-400", classNames?.endContent as string),
      }}
      thumbIcon={({ className }) =>
        selectedIsLight ? (
          <SunIconModern className={clsx(className, "text-orange-500")}
            size={16}
          />
        ) : (
          <MoonIconModern className={clsx(className, "text-blue-400")}
            size={16}
          />
        )
      }
    />
  );
};
