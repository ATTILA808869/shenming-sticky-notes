export function SectionTitle({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="mb-2 text-sm font-black text-temple-red">{eyebrow}</p> : null}
      <h2 className="text-3xl font-black tracking-normal text-temple-ink md:text-4xl">{title}</h2>
      {body ? <p className="mt-3 text-base leading-7 text-neutral-600">{body}</p> : null}
    </div>
  );
}
