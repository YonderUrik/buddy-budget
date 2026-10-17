import Link from "next/link";
import { Fragment } from "react";
import type { RichPart } from "@/content/security";

/** A sentence made of plain strings and links: internal paths use `next/link`, `mailto:` stays a plain link, the rest opens in a new tab. */
export function RichText({ parts }: { parts: readonly RichPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") return <Fragment key={i}>{part}</Fragment>;
        if (part.href.startsWith("/")) return <Link key={i} href={part.href}>{part.text}</Link>;
        if (part.href.startsWith("mailto:")) return <a key={i} href={part.href}>{part.text}</a>;
        return <a key={i} href={part.href} rel="noopener" target="_blank">{part.text}</a>;
      })}
    </>
  );
}
