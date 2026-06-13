"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/tasks/ariane133-asap7-mixed-placement", label: "Task" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/launch", label: "Launch" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-base/80 backdrop-blur-md">
      <div className="max-w-[1500px] mx-auto px-5 lg:px-8 h-14 flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo />
          <span className="font-display font-extrabold tracking-[-0.03em] text-[15px]">
            PD<span className="text-amber">·</span>BENCH
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-sm transition-colors ${
                  active
                    ? "text-amber bg-amber/[0.08]"
                    : "text-ink-dim hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <a
          href="https://github.com/ricursive/pd-bench"
          target="_blank"
          rel="noreferrer"
          className="ml-auto label hover:text-ink-dim transition-colors"
        >
          ricursive/pd-bench ↗
        </a>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="19" height="19" stroke="currentColor" className="text-line-strong" />
      <rect x="4" y="4" width="5" height="5" className="fill-amber" />
      <rect x="11" y="4" width="5" height="5" stroke="currentColor" className="text-ink-faint" />
      <rect x="4" y="11" width="5" height="5" stroke="currentColor" className="text-ink-faint" />
      <rect x="11" y="11" width="5" height="5" className="fill-cyan" />
    </svg>
  );
}
