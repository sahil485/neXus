import type { Metadata } from "next";
import { Syne, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Nexus - AI-Powered X Network Explorer",
  description: "Discover and connect with your extended network on X using AI-powered semantic search and personalized introductions.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${syne.variable} ${jetbrainsMono.variable} antialiased min-h-screen`}
        style={{ fontFamily: 'var(--font-syne), system-ui, sans-serif' }}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
