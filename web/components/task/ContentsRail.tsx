"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Item {
  id: string;
  label: string;
}

/** Sticky datasheet index with scroll-spy + a pinned Launch CTA. */
export function ContentsRail({ items, launchHref }: { items: Item[]; launchHref: string }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((e): e is HTMLElement => !!e);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav className="sticky top-20 hidden lg:flex flex-col gap-1">
      <div className="label mb-2">contents</div>
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className={`text-sm py-1 border-l-2 pl-3 -ml-px transition-colors ${
            active === i.id
              ? "border-amber text-amber"
              : "border-line text-ink-dim hover:text-ink hover:border-line-strong"
          }`}
        >
          {i.label}
        </a>
      ))}
      <Link
        href={launchHref}
        className="mt-5 px-3 py-2 bg-amber text-base text-sm font-medium text-center hover:bg-amber/90 transition-colors"
      >
        Launch your agent →
      </Link>
    </nav>
  );
}
