import { siteConfig } from "@/config/site";
import { getDictionary, Locale } from "@/lib/dictionaries";
import { Link } from "@heroui/link";

export default async function PrivacyPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const lastUpdated = "2025-01-01";

  const appName = siteConfig.name;
  const replaceAppName = (text: string) => text.replace(/buddy\s*budget/gi, appName);

  const title = dict.legal?.privacy.title ? replaceAppName(dict.legal?.privacy.title) : "";
  const sections = (dict.legal?.privacy.sections ?? []).map((s) => ({
    title: replaceAppName(s.title),
    body: s.body.map((p) => replaceAppName(p)),
  }));

  return (
    <div className="mx-auto max-w-3xl py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">{title}</h1>
      <p className="text-sm text-foreground-500 mb-8">
        {dict.legal?.lastUpdatedLabel}: {" "}
        <time dateTime={lastUpdated}>{lastUpdated}</time>
      </p>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <section key={idx} className="space-y-3">
            <h2 className="text-xl font-medium">{section.title}</h2>
            {section.body.map((para, pidx) => (
              <p key={pidx} className="text-foreground-600 leading-relaxed">
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 text-foreground-600">
        <p>
          {dict.legal?.questions} {" "}
          <Link href={`mailto:${siteConfig.supportEmail}`} className="underline">
            {siteConfig.supportEmail}
          </Link>
        </p>
      </div>
    </div>
  );
}


