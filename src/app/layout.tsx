import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { VisitProvider } from "@/lib/visits";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NyaLife HMS",
  description: "Hospital management system dashboard",
  icons: {
    icon: [{ url: "/logo-transparent.png", type: "image/png" }],
    apple: [{ url: "/logo-transparent.png", type: "image/png" }],
  },
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
          <VisitProvider>{children}</VisitProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
