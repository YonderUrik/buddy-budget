/** Index label, title and one-line intro of a home section; `id` labels the section (`aria-labelledby`). */
export function SectionHead({ id, index, title, intro }: { id: string; index?: string; title: string; intro?: string }) {
  return (
    <>
      {index ? <p className="idx">{index}</p> : null}
      <h2 id={id}>{title}</h2>
      {intro ? <p className="intro">{intro}</p> : null}
    </>
  );
}
