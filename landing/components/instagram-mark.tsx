/** Instagram glyph (rounded square, lens, flash dot), drawn in the current colour like `GithubMark`. Decorative. */
export function InstagramMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.25" y="1.25" width="13.5" height="13.5" rx="4" />
      <circle cx="8" cy="8" r="3.1" />
      <circle cx="12" cy="4" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
