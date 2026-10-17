/** Title and one-line intro of a home section; `id` labels the section (`aria-labelledby`). */
export function SectionHead({ id, title, intro }: { id: string; title: string; intro?: string }) {
  return (
    <>
      <h2 id={id}>{title}</h2>
      {intro ? <p className="intro">{intro}</p> : null}
    </>
  );
}
