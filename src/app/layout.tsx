import type { Metadata } from "next";
import { Orbitron, Exo_2, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const exo2 = Exo_2({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sanbao — AI-платформа для профессионалов Казахстана",
    template: "%s — Sanbao",
  },
  description:
    "AI-платформа для юристов, бухгалтеров и таможенных специалистов. 18 кодексов, 344К+ законов, ТНВЭД, 1С — всё в одном месте.",
  keywords: [
    "AI ассистент", "юрист Казахстан", "НПА РК", "ТНВЭД", "1С консультант",
    "таможенный брокер", "бухгалтерия", "искусственный интеллект", "sanbao",
  ],
  authors: [{ name: "Sanbao" }],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Sanbao",
    title: "Sanbao — AI-платформа для профессионалов Казахстана",
    description:
      "Юрист, Брокер, Бухгалтер и 1С Консультант — 4 AI-специалиста с глубокой базой знаний. Navigate with Intelligence.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${orbitron.variable} ${exo2.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
