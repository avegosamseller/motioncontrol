import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Motion Control - Kling Video Generator",
  description: "Generate motion control videos using Kling AI models via Magnific API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
