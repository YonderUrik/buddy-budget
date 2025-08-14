import { siteConfig } from "@/config/site";
import { getDictionary, Locale } from "@/lib/dictionaries";
import { Link } from "@heroui/link";

export default async function CookiesPolicyPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = await params;
  const dict = await getDictionary(locale as Locale);
  const lastUpdated = "2025-01-01";

  const appName = siteConfig.name;
  const replaceAppName = (text: string) => text.replace(/buddy\s*budget/gi, appName);

  const title = dict.legal?.cookies?.title ? replaceAppName(dict.legal.cookies.title) : "Cookie Policy";
  const sections = (dict.legal?.cookies?.sections ?? [
    {
      title: "1. What are cookies",
      body: [
        `${appName} uses cookies and similar technologies to operate the website, understand usage, and improve the experience.`,
      ],
    },
    {
      title: "2. Types of cookies we use",
      body: [
        "Essential: required for core functionality (authentication, security).",
        "Preferences: remember your settings such as language and theme.",
        "Analytics: help us understand how the site is used to improve it.",
      ],
    },
    {
      title: "3. Managing cookies",
      body: [
        "You can accept or reject non-essential cookies via the cookie banner. You can also control cookies in your browser settings.",
      ],
    },
    {
      title: "4. Changes",
      body: [
        "We may update this Cookie Policy from time to time. We will notify users of significant changes.",
      ],
    },
  ]).map((s) => ({
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


