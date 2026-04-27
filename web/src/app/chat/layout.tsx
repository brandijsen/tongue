import type { Metadata } from "next";

const chatDescription = "Conversazione e notizie con fonti verificabili";

export const metadata: Metadata = {
  title: { absolute: "Tongue" },
  description: chatDescription,
  openGraph: {
    title: "Tongue",
    description: chatDescription,
  },
  twitter: {
    title: "Tongue",
    description: chatDescription,
  },
};

export default function ChatLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
