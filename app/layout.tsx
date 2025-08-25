import "./globals.css";
import { ReactNode } from "react";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Translation Minutes",
  description: "Real-time transcription and minutes generator",
  icons: {
    icon: [{ url: "/translation-minutes.png" }],
    apple: [{ url: "/translation-minutes.png" }],
    shortcut: ["/translation-minutes.png"],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Translation Minutes",
    description: "Real-time transcription and minutes generator",
    images: [{ url: "/translation-minutes.png", width: 1200, height: 630, alt: "Translation Minutes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Translation Minutes",
    description: "Real-time transcription and minutes generator",
    images: ["/translation-minutes.png"],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#111827",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-dvh antialiased bg-background text-foreground">
        <div className="mx-auto max-w-screen-sm p-3 sm:p-4 pb-28 md:pb-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 6rem)" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
