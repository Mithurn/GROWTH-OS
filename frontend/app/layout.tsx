import type { Metadata } from "next";
import "./globals.css";
import { MainLayout } from "@/components/main-layout";

export const metadata: Metadata = {
  title: "GrowthOS",
  description: "AI Growth Copilot for retail marketers",
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
