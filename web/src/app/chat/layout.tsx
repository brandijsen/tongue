import type { Metadata } from "next";
import { CHAT_DESCRIPTION, OG_LOGO_IMAGE, SITE_NAME } from "@/lib/siteMetadata";

export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  description: CHAT_DESCRIPTION,
  openGraph: {
    title: SITE_NAME,
    description: CHAT_DESCRIPTION,
    images: [OG_LOGO_IMAGE],
  },
  twitter: {
    title: SITE_NAME,
    description: CHAT_DESCRIPTION,
    images: [OG_LOGO_IMAGE],
  },
};

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
