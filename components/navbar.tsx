"use client";

import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
  NavbarProps,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
} from "@heroui/navbar";
import { Link } from "@heroui/link";
import React from "react";
import {Icon} from "@iconify/react";

import { siteConfig } from "@/config/site";
import {
  Logo,
} from "@/components/icons";
import { cn } from "@heroui/theme";
import { Button } from "@heroui/button";

export const Navbar = React.forwardRef<HTMLElement, NavbarProps>(
  ({ classNames = {}, dict = {}, ...props }, ref) => {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);

    return (
      <HeroUINavbar
        ref={ref}
        {...props}
        classNames={{
          base: cn("border-default-100 bg-transparent", {
            "bg-default-200/50 dark:bg-default-100/50": isMenuOpen,
          }),
          wrapper: "w-full justify-center",
          item: "hidden md:flex",
          ...classNames,
        }}
        height="60px"
        isMenuOpen={isMenuOpen}
        onMenuOpenChange={setIsMenuOpen}
      >
        {/* Left Content */}
        <NavbarBrand>
          <div className="bg-default-foreground text-background rounded-full">
            <Logo size={34} />
          </div>
          <span className="text-small text-default-foreground ml-2 font-medium">{siteConfig.name}</span>
        </NavbarBrand>

        {/* Right Content */}
        <NavbarContent className="hidden md:flex" justify="end">
          <NavbarItem>
            <Link href="#features" className="text-foreground-500 hover:text-foreground">{dict.navigation.features}</Link>
          </NavbarItem>
          <NavbarItem>
            <Link href="#how-it-works" className="text-foreground-500 hover:text-foreground">{dict.navigation.howItWorks}</Link>
          </NavbarItem>
          <NavbarItem>
            <Link href="#faq" className="text-foreground-500 hover:text-foreground">{dict.navigation.faq}</Link>
          </NavbarItem>
          <NavbarItem className="ml-2 flex! gap-2">
            <Button
              as={Link}
              href="/auth"
              className="bg-default-foreground text-background font-medium"
              color="secondary"
              endContent={<Icon icon="solar:alt-arrow-right-linear" />}
              radius="full"
              variant="flat"
            >
              {dict.navigation.login}
            </Button>
          </NavbarItem>
        </NavbarContent>

        <NavbarMenuToggle className="text-default-400 md:hidden" />

        <NavbarMenu
          className="bg-default-200/50 shadow-medium dark:bg-default-100/50 top-[calc(var(--navbar-height)-1px)] max-h-fit pt-6 pb-6 backdrop-blur-md backdrop-saturate-150"
          motionProps={{
            initial: { opacity: 0, y: -20 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -20 },
            transition: {
              ease: "easeInOut",
              duration: 0.2,
            },
          }}
        >
          <NavbarMenuItem>
            <Link href="#features">{dict.navigation.features}</Link>
          </NavbarMenuItem>
          <NavbarMenuItem>
            <Link href="#how-it-works">{dict.navigation.howItWorks}</Link>
          </NavbarMenuItem>
          <NavbarMenuItem className="mb-4">
            <Link href="#faq">{dict.navigation.faq}</Link>
          </NavbarMenuItem>
          <NavbarMenuItem className="mb-4">
            <Link href="/auth" className="w-full">
              <Button fullWidth className="bg-foreground text-background">
                {dict.navigation.login}
              </Button>
            </Link>
          </NavbarMenuItem>
        </NavbarMenu>
      </HeroUINavbar>
    );
  });
