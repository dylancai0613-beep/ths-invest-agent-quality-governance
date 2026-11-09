import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "投研回答质检台",
  description: "投资 AI 回答质量评测、人工复核与版本治理工作台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
