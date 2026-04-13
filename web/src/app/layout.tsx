import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ProvenanceAI — AI Pipeline Safety Layer",
  description: "ProvenanceAI intercepts stale data before it reaches your LLM, quarantines bad embeddings automatically, and sends you a complete incident report with everything already handled. Like Cloudflare — but for AI pipelines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="h-full bg-background text-text-primary font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
