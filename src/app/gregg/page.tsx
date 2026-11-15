import type { Metadata } from "next";
import { GreggApp } from "@/components/gregg/GreggApp";
export const metadata: Metadata = { title: "Gregg shorthand" };
export default function Page() { return <GreggApp />; }
