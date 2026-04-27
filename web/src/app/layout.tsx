import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { sitePublicUrl } from "@/lib/sitePublicUrl";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
});

const appDescription = "Notizie in sintesi, con fonti verificabili";

export const metadata: Metadata = {
  metadataBase: new URL(sitePublicUrl()),
  title: {
    default: "Tongue",
    template: "%s | Tongue",
  },
  description: appDescription,
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Tongue",
    title: "Tongue",
    description: appDescription,
    images: [
      {
        url: "/brand/tongue-logo-wordmark.png",
        width: 560,
        height: 135,
        alt: "Tongue",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tongue",
    description: appDescription,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-zinc-100 dark:bg-black">
        <SiteHeader />
        <div className="flex w-full min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
