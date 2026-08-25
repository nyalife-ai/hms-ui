import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { VisitProvider } from "@/lib/visits";
import { PwaUpdateRoot } from "@/components/pwa-update-root";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

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
  themeColor: "#058b7c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>
          <VisitProvider>
            {children}
            <PwaUpdateRoot />
          </VisitProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
