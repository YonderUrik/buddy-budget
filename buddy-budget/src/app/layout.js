import "../styles/globals.css";
import { AuthProvider } from "../contexts/auth-context";
import I18nProvider from "../providers/i18n-provider";
import "../i18n/config"
import { ThemeProvider } from "@/providers/theme-provider";
import { config } from "@/lib/config";
import { Toaster } from "@/components/ui/toaster";

export const metadata = {
  title: config.appName,
  description: config.appDescription,
};

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster />
          <AuthProvider>
            <I18nProvider>
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
              </div>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
