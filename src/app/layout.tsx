import type { Metadata, Viewport } from "next";
import { Inter, Hind_Siliguri } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaRegister } from "@/components/pwa";

// GitHub Pages serves the site from /<repo-name>/ (set by the build)
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Bangla names and the ৳ sign
const bengali = Hind_Siliguri({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
};

export const metadata: Metadata = {
  title: "স্টোর ম্যানেজার - দোকান ব্যবস্থাপনা",
  description: "বিক্রি, পণ্য, কাস্টমার, বাকি ও খরচের হিসাব রাখার দোকান ম্যানেজমেন্ট সিস্টেম",
  keywords: ["store", "management", "POS", "inventory", "sales"],
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: `${basePath}/icon-192.png`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
  appleWebApp: {
    capable: true,
    title: "স্টোর",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${bengali.variable} font-sans antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster position="top-right" />
        <PwaRegister />
      </body>
    </html>
  );
}
