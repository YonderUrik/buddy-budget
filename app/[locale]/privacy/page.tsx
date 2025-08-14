import { redirect } from "next/navigation";

export default function PrivacyRedirect({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/legal/privacy`);
}


