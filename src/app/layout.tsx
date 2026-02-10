import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "헤이즐 어드민 | 꽃집 관리 시스템",
  description: "꽃집 매출, 지출, 고객을 쉽게 관리하세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={0}>
            {children}
          </TooltipProvider>
          <Toaster position="bottom-center" richColors duration={2000} />
        </ThemeProvider>
      </body>
    </html>
  );
}
