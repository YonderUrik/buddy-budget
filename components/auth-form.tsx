"use client";

import React from "react";
import { Button, Input, Checkbox, Link, Form, Divider } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Logo } from "@/components/icons";
import type { Dictionary } from "@/types/dictionary";
import { siteConfig } from "@/config/site";

export function AuthForm({ dict }: { dict: Dictionary }) {
  const [isVisible, setIsVisible] = React.useState(false);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("handleSubmit");
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-large flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center pb-6">
          <Logo clickable path="/" size={60} />
          <p className="text-xl font-medium">{dict.auth.welcomeBack}</p>
          <p className="text-small text-default-500">{dict.auth.loginToContinue}</p>
        </div>
        <div className="flex flex-col gap-2">
          {siteConfig.providers.map((provider) => (
            <Button disabled={!provider.active} key={provider.name} startContent={<Icon icon={provider.icon} width={24} />} variant="bordered">
              {dict.auth.continueWith} {provider.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}


