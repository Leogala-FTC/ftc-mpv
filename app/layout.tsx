import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FTC MVP",
  description: "Token app FTC MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <main className="mx-auto min-h-screen max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
