import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireSuperadmin } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireSuperadmin();
  return <div className="min-h-dvh bg-bg-panel p-8">{children}</div>;
}
