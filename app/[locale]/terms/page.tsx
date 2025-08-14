import { redirect } from "next/navigation";

export default function TermsRedirect({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}/legal/terms`);
}


