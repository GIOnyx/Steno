"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopBar() {
  const path = usePathname();
  const tab = path.startsWith("/gregg") ? "gregg" : "tsn";
  return (
    <header className="topbar">
      <div className="brand-top">
        <span className="name">Court Steno Tools</span>
        <span className="court">MTCC Carcar City</span>
      </div>
      <nav aria-label="Tools">
        <Link href="/tsn" aria-current={tab === "tsn" ? "page" : undefined}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5 3.5h7l3 3V16.5H5z" />
            <path d="M12 3.5v3h3M7.5 10h5M7.5 13h4" />
          </svg>
          <span>TSN from Scriptix</span>
        </Link>
        <Link href="/gregg" aria-current={tab === "gregg" ? "page" : undefined}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 14.5c2.5-4.5 5-7 7.5-7 1.8 0 2.2 1.7.8 3.2-1.4 1.5-3.8 2.3-4.3 3.8M11 13.5c2 0 4-1.5 5-3.5" />
          </svg>
          <span>Gregg shorthand</span>
        </Link>
      </nav>
      <span className="right" title="Everything runs locally in your browser">
        <span className="dot" aria-hidden="true" />
        Works offline · Files stay on this PC
      </span>
    </header>
  );
}
