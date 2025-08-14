"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { getCookie, setCookie } from "cookies-next/client";
import type { Dictionary } from "@/types/dictionary";

interface CookieConsentBannerProps {
  dict?: Dictionary;
  locale?: string;
}

export function CookieConsentBanner({ dict, locale }: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = getCookie("cookie_consent");
    setIsVisible(!consent);
  }, []);

  if (!isVisible) return null;

  const handleAccept = () => {
    setCookie("cookie_consent", "accepted", {
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    setIsVisible(false);
  };

  const handleReject = () => {
    setCookie("cookie_consent", "rejected", {
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    setIsVisible(false);
  };

  const bannerDict = dict?.legal?.cookieBanner as any;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-3xl rounded-large border border-default-200 bg-background/95 p-4 shadow-large backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-foreground-600">
            <p className="font-medium text-foreground mb-1">{bannerDict?.title ?? "We use cookies"}</p>
            <p>
              {bannerDict?.description ?? "We use essential cookies to make this site work and analytics cookies to understand usage."} {" "}
              <Link href={`/${locale ?? "en"}/legal/cookies`} className="underline">
                {bannerDict?.policy ?? "Cookie Policy"}
              </Link>
              .
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="flat" onPress={handleReject}>
              {bannerDict?.reject ?? "Reject"}
            </Button>
            <Button size="sm" color="secondary" className="bg-default-foreground text-background" onPress={handleAccept}>
              {bannerDict?.accept ?? "Accept all"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


