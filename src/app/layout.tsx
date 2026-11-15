import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OmniPay Resilience Engine | Distributed Fintech Simulation",
  description:
    "In-browser simulation of idempotency, status inquiry, retry backoff and transaction pipelines across Global and Iranian payment ecosystems. No real payments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${vazirmatn.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-canvas text-text-primary">
        {children}
      </body>
    </html>
  );
}
