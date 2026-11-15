import type { Metadata } from "next";
import { TsnApp } from "@/components/tsn/TsnApp";
export const metadata: Metadata = { title: "TSN from Scriptix" };
export default function Page() { return <TsnApp />; }
