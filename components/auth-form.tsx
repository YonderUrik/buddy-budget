"use client";

import React from "react";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Logo } from "@/components/icons";
import type { Dictionary } from "@/types/dictionary";
import { siteConfig } from "@/config/site";
import { signIn } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";

export function AuthForm({ dict }: { dict: Dictionary }) {
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const error = searchParams?.get("error");

  const errorMessage = React.useMemo(() => {
    if (!error) return null;
    const map: Record<string, string> = {
      Callback: (dict as any)?.auth?.errorCallback ?? "Authentication failed. Please try again.",
      OAuthSignin: (dict as any)?.auth?.errorOAuthSignin ?? "Could not start sign-in.",
      OAuthCallback: (dict as any)?.auth?.errorOAuthCallback ?? "Provider callback failed.",
      OAuthAccountNotLinked: (dict as any)?.auth?.errorAccountNotLinked ?? "This email is already linked to another provider.",
      EmailCreateAccount: (dict as any)?.auth?.errorCreateAccount ?? "Could not create account.",
      AccessDenied: (dict as any)?.auth?.errorAccessDenied ?? "Access denied.",
      Verification: (dict as any)?.auth?.errorVerification ?? "Invalid or expired verification.",
      Default: (dict as any)?.auth?.errorDefault ?? "Something went wrong. Please try again.",
    };
    return map[error] ?? map.Default;
  }, [error, dict]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-large flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center pb-6">
          <Logo clickable path="/" size={60} />
          <p className="text-xl font-medium">{dict.auth.welcomeBack}</p>
          <p className="text-small text-default-500">{dict.auth.loginToContinue}</p>
        </div>
        {errorMessage && (
          <div className="rounded-medium border border-danger/40 bg-danger-50 text-danger-700 px-3 py-2 text-sm">
            {errorMessage}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {siteConfig.providers.map((provider) => (
            <Button
              disabled={!provider.active}
              key={provider.id}
              startContent={<Icon icon={provider.icon} width={24} />}
              variant="bordered"
              onPress={() => {
                const callbackUrl = `/${params?.locale ?? "en"}/dashboard`;
                if (provider.active) signIn(provider.id, { callbackUrl });
              }}
            >
              {dict.auth.continueWith} {provider.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}


