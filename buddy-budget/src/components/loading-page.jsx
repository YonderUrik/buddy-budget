"use client"

import { config } from "@/lib/config";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { AppIcon } from "./logo/app-icon";

export default function LoadingPage() {
   const { t } = useTranslation()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center ">
      <Card className="w-[350px] shadow-lg">
        <CardHeader className="text-center space-y-4">
          <AppIcon size="lg" className="mx-auto" />
          <CardTitle className="text-2xl font-bold">{config.appName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
