import type { Metadata } from "next";
import "./globals.css";
import { MainLayout } from "@/components/main-layout";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://growos-ai.vercel.app";

const TITLE = "GrowthOS — an autonomous AI growth agent for retail";
const DESCRIPTION =
  "Upload your customer data and GrowthOS finds where revenue is leaking, writes the campaign to recover it, and tracks what converted. You approve the decisions — it does the work.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "GrowthOS",
  authors: [{ name: "Mithurn Jeromme", url: "https://github.com/Mithurn" }],
  keywords: [
    "AI CRM",
    "growth agent",
    "customer segmentation",
    "RFM analysis",
    "marketing automation",
    "retail analytics",
  ],
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  // Drives the preview card when the link is shared on LinkedIn, X, or Slack.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "GrowthOS",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "GrowthOS" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
