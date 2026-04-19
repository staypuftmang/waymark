import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const styleFonts = [
  "Playfair+Display:wght@400;700;900",
  "Source+Serif+4:ital,wght@0,400;0,600;1,400",
  "Caveat:wght@400;700",
  "Nunito:wght@400;600",
  "Bebas+Neue",
  "Karla:wght@400;600",
  "Cormorant+Garamond:wght@400;600;700",
  "Lora:ital,wght@0,400;0,600;1,400",
  "Josefin+Sans:wght@300;400",
  "Anton",
  "Space+Mono:wght@400;700",
].join("&family=");

const styleFontsUrl = `https://fonts.googleapis.com/css2?family=${styleFonts}&display=swap`;

export const metadata: Metadata = {
  title: "Waymark",
  description:
    "Mark the moments that moved you. Turn travel photos into beautifully styled journals with AI.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${manrope.variable}`}>
      <head>
        <link rel="stylesheet" href={styleFontsUrl} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
