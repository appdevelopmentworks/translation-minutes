import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Translation Minutes",
  description: "Real-time transcription and minutes generator",
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
