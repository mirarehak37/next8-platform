import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SIDEBAR_WIDTH_SCRIPT } from "@/lib/sidebar";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "NEXT8 Platform",
  description: "Modulární business platforma pro digitalizaci firemních procesů",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`dark ${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <Script id="sidebar-width" strategy="beforeInteractive">
          {SIDEBAR_WIDTH_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <TooltipProvider delay={200}>
          {children}
          <Toaster theme="dark" position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
