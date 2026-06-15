import type { ReactNode } from "react";

interface Props {
  n: number;
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

/** A numbered datasheet section: `01 · OBJECTIVE` header + hairline + body. */
export function SpecSection({ n, id, title, action, children }: Props) {
  return (
    <section id={id} className="scroll-mt-20 pt-9 first:pt-0">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="flex items-baseline gap-2.5">
          <span className="section-num">{String(n).padStart(2, "0")} ·</span>
          <span className="label !text-ink !tracking-[0.16em]">{title}</span>
        </h2>
        {action}
      </div>
      <div className="text-[14px] leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}
