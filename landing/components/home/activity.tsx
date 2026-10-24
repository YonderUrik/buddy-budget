import Link from "next/link";
import type { ActivityText } from "@/content/project";
import type { ProjectActivity } from "@/lib/changelog";
import { rise } from "@/lib/motion/rise";
import { TrackedSection } from "../tracked-section";

/**
 * «Ancora niente iscritti da contare»: where a usage counter would stand, the one count that is true before launch.
 * Three figures read from `CHANGELOG.md` at build time (releases, releases with a new feature, the date of the latest),
 * set large on the navy field like the tax figures, with the links to the dated changelog and to who builds it.
 * Hidden when the build has no changelog (`activity` null).
 */
export function Activity({ text, activity }: { text: ActivityText; activity: ProjectActivity | null }) {
  if (!activity) return null;
  return (
    <TrackedSection id="attivita" section="attivita" className="sec act" field="navy" aria-labelledby="attivita-t">
      <div className="wrap">
        <div className="act-head">
          <h2 id="attivita-t" data-rise>{text.title}</h2>
          <p data-rise style={rise(1)}>{text.text}</p>
        </div>
        <dl className="act-figs">
          {text.figures(activity).map((f, i) => (
            <div key={f.caption} data-rise style={rise(2 + i)}>
              <dt>{f.caption}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="act-foot" data-rise style={rise(5)}>
          <Link className="more" href={text.changelog.href}>{text.changelog.label}</Link>
          <Link className="more" href={text.about.href}>{text.about.label}</Link>
          <p>{text.source}</p>
        </div>
      </div>
    </TrackedSection>
  );
}
