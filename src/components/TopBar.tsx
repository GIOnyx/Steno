"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function TopBar() {
  const path = usePathname();
  const tab = path.startsWith("/gregg") ? "gregg" : "tsn";
  return (
    <header className="topbar">
      <span className="name">Court Steno Tools<small>MTCC Carcar City</small></span>
      <nav aria-label="Tools">
        <Link href="/tsn" aria-current={tab === "tsn" ? "page" : undefined}>TSN from Scriptix</Link>
        <Link href="/gregg" aria-current={tab === "gregg" ? "page" : undefined}>Gregg shorthand</Link>
      </nav>
      <span className="right">Runs in your browser. Files never leave this computer.</span>
    </header>
  );
}
