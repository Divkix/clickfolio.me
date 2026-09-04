import type { Metadata } from "next";
import { SidebarLayoutClient } from "./SidebarLayoutClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayoutClient>{children}</SidebarLayoutClient>;
}
