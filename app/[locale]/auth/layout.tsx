import { Footer } from "@/components/footer";
import { ScrollToTop } from "@/components/scroll-to-top";
import { getDictionary, Locale } from "@/lib/dictionaries";

export default async function AuthLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return <div className="relative flex flex-col h-screen">
    <main className="container mx-auto max-w-7xl pt-16 px-6 flex-grow">
      {children}
    </main>
    <ScrollToTop />
    <Footer dict={dict} locale={locale} />
  </div>;
}