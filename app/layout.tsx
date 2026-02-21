import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hiyori — VTuber AI",
  description: "Chat với Hiyori, VTuber AI siêu cấp pro vip",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script src="/live2d/live2d.min.js" strategy="beforeInteractive" />
        <Script src="/live2d/live2dcubismcore.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}