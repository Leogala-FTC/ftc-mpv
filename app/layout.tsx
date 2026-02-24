import type { Metadata } from "next";
import { TopNav } from "./components/top-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "FTC MVP",
  description: "FTC MVP auth and onboarding flow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
