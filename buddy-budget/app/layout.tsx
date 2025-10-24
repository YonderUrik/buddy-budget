import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Vortex } from "@/components/ui/vortex";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen text-foreground bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <div className="relative flex flex-col min-h-screen">
            <Vortex
              backgroundColor="transparent"
              baseHue={60}
              className="flex flex-col w-full min-h-screen"
              containerClassName="absolute inset-0 w-full min-h-screen"
              particleCount={1000}
              rangeRadius={2}
              rangeY={120}
            >
              <Navbar />
              <main className="container mx-auto pt-24 px-6 flex-grow">
                {children}
              </main>
              <Footer />
            </Vortex>
          </div>
        </Providers>
      </body>
    </html>
  );
}
