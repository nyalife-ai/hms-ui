import type { Metadata, Viewport } from "next";
import { inter, manrope, sourceCodePro } from "@/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { VisitProvider } from "@/lib/visits";

export const metadata: Metadata = {
  title: "NyaLife HMS",
  description: "Hospital management system dashboard",
  applicationName: "NyaLife HMS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "NyaLife",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/logo-transparent.png", type: "image/png" }],
    apple: [{ url: "/logo-transparent.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f02878" },
    { media: "(prefers-color-scheme: dark)", color: "#120c14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${sourceCodePro.variable} h-full antialiased`}
    >
      {/*
        Studio wires --font-sans / --font-heading / mono via next/font family names
        (see apps/studio/pages/_app.tsx). Keep the same contract for Tailwind tokens.
      */}
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--font-sans:${inter.style.fontFamily};--font-heading:${manrope.style.fontFamily};--font-source-code-pro:${sourceCodePro.style.fontFamily};}`,
          }}
        />
        {/* Prevent FOUC — mirrors next-themes / Studio pre-hydration class apply */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('nyalife-theme')||'system';var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-full`}>
        <ThemeProvider>
          <AuthProvider>
            <VisitProvider>{children}</VisitProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
