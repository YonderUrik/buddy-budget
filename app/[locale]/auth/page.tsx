import { getDictionary, Locale } from "@/lib/dictionaries";
import { AuthForm } from "@/components/auth-form";

export default async function AuthPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);

  return <AuthForm dict={dict} />;
}
