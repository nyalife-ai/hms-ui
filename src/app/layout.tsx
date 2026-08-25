import type { Metadata, Viewport } from "next";
import { inter, manrope, sourceCodePro } from "@/fonts";
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
  themeColor: "#f02878",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
      </head>
      <body className={`${inter.className} min-h-full`}>
        <AuthProvider>
          <VisitProvider>{children}</VisitProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
