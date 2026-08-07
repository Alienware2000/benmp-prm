import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: "BENMP PRM",
  description:
    "Global Crusade Partners Platform for BENMP and Healing Jesus Campaign staff.",
  other: {
    "color-scheme": "only light",
  },
};

export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#f4f6f7",
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
      style={{ colorScheme: "only light" }}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
