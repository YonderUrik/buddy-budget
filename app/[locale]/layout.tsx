import { notFound } from "next/navigation";

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

  return <>{children}</>;
}