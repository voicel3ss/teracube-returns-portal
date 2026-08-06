import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teracube Device Care",
  description: "Replacement, repair, and refurbishment operations for Teracube devices.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
