import { ThemeProvider, QueryProvider, Toaster, TooltipProvider } from "@open-mtlms/core";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";

import { ChunkRecovery } from "@/components/ChunkRecovery";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { UtmCapture } from "@/components/providers/utm-capture";
import { ADMIN_APP_NAME } from "@/lib/brand";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: ADMIN_APP_NAME,
  description: "Manage your academy",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Certificate fonts (incl. signature/handwriting faces: Marck Script,
            Mea Culpa) loaded deterministically in <head> so the designer,
            presets, and issued certificates all render the same fonts. Same id
            the useCertificateFonts hook checks, so it won't double-inject. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          id="certificate-fonts"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Marck+Script&family=Mea+Culpa&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Lora:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,700;1,9..144,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} font-sans antialiased`}>
        {/* Auto-recover from stale-deploy chunk errors (blank/hanging page). */}
        <ChunkRecovery />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={300}>
            <QueryProvider>
              <PostHogProvider>
                <Suspense fallback={null}><UtmCapture /></Suspense>
                {children}
                <Toaster />
              </PostHogProvider>
            </QueryProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
