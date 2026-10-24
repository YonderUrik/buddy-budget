/** English texts of the project block and pages (`content/project.ts` explains the rules: only what anyone can check). */
import { longDate } from "@/lib/format";
import { CODE_PUBLIC_SINCE, CONTRIBUTORS, FOUNDER, type ProjectContent } from "../project";
import { EN_PATHS } from "../locales";

export const PROJECT_EN: ProjectContent = {
  locale: "en",
  activity: {
    title: "No sign-ups to count yet.",
    text: "We're just starting, so we won't show you user numbers. We show you the work: every release is public, with its date and what changed.",
    figures: (a) => [
      { value: String(a.releases), caption: `releases since ${longDate(a.firstDate, "en")}` },
      { value: String(a.featureReleases), caption: "with at least one new feature" },
      { value: longDate(a.latest.date, "en", true), caption: `the latest release, ${a.latest.version}` },
    ],
    source: "Counted from the code's CHANGELOG.md at every release.",
    changelog: { label: "Every update, with dates", href: EN_PATHS.changelog },
    about: { label: "Who's behind it", href: EN_PATHS.about },
  },
  about: {
    title: "Who's behind it",
    metaTitle: `Who's behind BuddyBudget: ${FOUNDER.name}, Turin`,
    description: `BuddyBudget is built by ${FOUNDER.name}, a developer in Turin, Italy: why it exists, how it's made, who contributed and how to reach Daniele.`,
    lead: `BuddyBudget is built by ${FOUNDER.name}, a developer in Turin, Italy, in spare time. There's no company behind it: there's one person, with a name.`,
    sections: (a) => [
      {
        title: "Why it exists",
        paragraphs: [
          "Most people who keep an eye on their money use three tools: an app for spending, a spreadsheet for investments, another one for the mortgage. BuddyBudget puts them in one app and one number.",
          "And it applies the Italian rules where they change the result: capital gains and losses, the zainetto fiscale (tax-loss carryforward), the 12.5% rate on government bonds, bollo (stamp duty), pension fund taxation.",
        ],
      },
      {
        title: "How it's made",
        paragraphs: [
          "It's written mostly by one person, with an AI coding assistant. Every number comes from a tested function, and every choice has a public note with its date and the reason.",
        ],
        links: [
          { label: "The decisions, one per file", href: "decisions" },
          { label: "How each number is calculated", href: "architecture" },
        ],
      },
      {
        title: "Since when",
        paragraphs: [
          a
            ? `The code has been public since ${longDate(CODE_PUBLIC_SINCE, "en")}. The first numbered release came out on ${longDate(a.firstDate, "en")}; ${a.releases} releases since then, the latest on ${longDate(a.latest.date, "en")}.`
            : `The code has been public since ${longDate(CODE_PUBLIC_SINCE, "en")}.`,
        ],
        links: [{ label: "Every update, with dates", href: EN_PATHS.changelog }],
      },
      {
        title: "Who contributed",
        paragraphs: [
          `Besides Daniele, ${CONTRIBUTORS.map((c) => c.handle).join(" and ")} have written code. Anyone can report a problem or propose a change on GitHub.`,
        ],
        links: [
          { label: "Contributors", href: "contributors" },
          { label: "Report a problem", href: "issues" },
        ],
      },
      {
        title: "Who is responsible for your data",
        paragraphs: [
          `The data controller is ${FOUNDER.name}, an individual, who runs BuddyBudget free of charge during the beta. Address and details are in the privacy policy.`,
        ],
        links: [{ label: "Privacy policy", href: EN_PATHS.privacy }],
      },
    ],
    ctaTitle: "Your number, from tomorrow morning.",
    ctaText: "Want to look first? The demo is Giulia's account, no sign-up needed.",
  },
  changelog: {
    title: "Changelog",
    metaTitle: "BuddyBudget changelog: every release with its date",
    description: "Every BuddyBudget release with its date and what changed, read from the code at each release.",
    lead: (a) =>
      a
        ? `Every release of the app with its date and what changed, read from the code at each release: ${a.releases} releases since ${longDate(a.firstDate, "en")}.`
        : "Every release of the app with its date and what changed, read from the code at each release.",
    note: "Lines are the titles of the code changes: the older ones are in Italian. Library updates are not listed.",
    kinds: { feat: "New", fix: "Fix", perf: "Faster" },
    pr: "change",
    missing: "The release history is on GitHub.",
    github: "Releases on GitHub",
    ctaTitle: "Your number, from tomorrow morning.",
    ctaText: "Want to look first? The demo is Giulia's account, no sign-up needed.",
  },
};
