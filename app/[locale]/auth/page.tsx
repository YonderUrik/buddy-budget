import { getDictionary, Locale } from "@/lib/dictionaries";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const session = await getSession();
  if (session?.user) redirect(`/${locale}/dashboard`);
  return <AuthForm dict={dict} />;
}
