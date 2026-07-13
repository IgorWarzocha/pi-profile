import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PROFILE_OVERVIEW } from "./generated/profile-overview";
import "./globals.css";

export const metadata: Metadata = {
  title: `${PROFILE_OVERVIEW.profile.name} · Pi Profile`,
  description: "A public activity profile built from Pi coding-agent sessions.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
