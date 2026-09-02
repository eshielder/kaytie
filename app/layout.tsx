import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KT — Learn by talking",
  description:
    "KT is a voice-first AI tutor. Press start, speak naturally, and learn by talking.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "KT",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
