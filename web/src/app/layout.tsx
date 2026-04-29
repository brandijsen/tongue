import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { sitePublicUrl } from "@/lib/sitePublicUrl";
import {
  OG_LOGO_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/siteMetadata";
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

const appDescription = SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(sitePublicUrl()),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: appDescription,
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: appDescription,
    images: [OG_LOGO_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: appDescription,
    images: [OG_LOGO_IMAGE],
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
      <body className="flex min-h-dvh flex-col bg-zinc-100">
        <SiteHeader />
        <div className="flex w-full min-w-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
