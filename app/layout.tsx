import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Zylo-Buylo.com | Ecommerce and Vendor Marketplace",
    template: "%s | Zylo-Buylo.com",
  },
  description:
    "Shop fashion, home essentials, hardware, appliance parts and vendor products on Zylo-Buylo.com.",
  applicationName: "Zylo-Buylo.com",
  keywords: [
    "Zylo Buylo",
    "ecommerce",
    "vendor marketplace",
    "AC parts",
    "washing machine parts",
    "TV parts",
    "hardware",
    "home fittings",
  ],
  authors: [{ name: "Zylo-Buylo.com" }],
  creator: "Zylo-Buylo.com",
  publisher: "Zylo-Buylo.com",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Zylo-Buylo.com",
    description:
      "A responsive ecommerce and vendor marketplace for fashion, home, hardware and appliance parts.",
    url: "/",
    siteName: "Zylo-Buylo.com",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zylo-Buylo.com",
    description:
      "Shop vendor products, home essentials, appliance parts and more.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/zylo-logo-mark.svg",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
