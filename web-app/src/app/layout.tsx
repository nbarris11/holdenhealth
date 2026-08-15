import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Holden Health Member Portal",
  description:
    "Private session schedules, check-ins, resources, and coaching support for Holden Health members.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
