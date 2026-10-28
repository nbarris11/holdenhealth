import type { Metadata } from "next";
import LegalLinks from "@/components/legal-links";
import PostHogIdentity from "@/components/posthog-identity";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holden Health Member Portal",
  applicationName: "Holden Health",
  appleWebApp: { title: "Holden Health", capable: true },
  description:
    "Workouts, habits, and messages with Kelsey for Holden Health members.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><PostHogIdentity />{children}<LegalLinks /></body>
    </html>
  );
}
