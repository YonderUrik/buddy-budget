import { notFound } from "next/navigation";
import { getDictionary, Locale } from "@/lib/dictionaries";
import { CookieConsentBanner } from "@/components/cookie-consent";

const locales = ['en', 'it'];

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = await params;

  if (!locales.includes(locale as any)) notFound();

  const dict = await getDictionary(locale as Locale);

  return <>
    {children}
    <CookieConsentBanner dict={dict} locale={locale} />
  </>;
}