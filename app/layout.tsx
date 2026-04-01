import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iRam Call Cycle Builder",
  description: "iRam Call Cycle Builder — Convert raw call cycle files to Perigee format",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
