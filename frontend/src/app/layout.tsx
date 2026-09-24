import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const SITE_URL = getSiteUrl();
const BRAND_NAME = "我的职业规划ai导师";
const BRAND_ICON = "/brand-icon.png";

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} | 简历、学习路线与模拟面试`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "中英双语 AI 职业成长平台，提供简历 ATS 审核、个性化学习路线、就业市场数据、领英优化和十阶段模拟面试。",
  keywords: [
    "AI career mentor",
    "resume ATS scorer",
    "mock interview AI",
    "career roadmap generator",
    "LinkedIn optimizer",
    "salary trends",
    "job market data",
    "free career tools",
    "software engineer interview prep",
    "career transition",
  ],
  authors: [{ name: "Anil Pradhan" }],
  creator: "Anil Pradhan",
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: BRAND_NAME,
    description:
      "简历分析、个性化学习路线、中国就业市场、领英优化与模拟面试。",
    url: SITE_URL,
    siteName: BRAND_NAME,
    locale: "zh_CN",
    type: "website",
    images: [
      {
        url: BRAND_ICON,
        width: 384,
        height: 384,
        alt: BRAND_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description:
      "简历分析、学习路线、就业市场和模拟面试，辅助规划职业发展。",
    images: [BRAND_ICON],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: BRAND_ICON, type: "image/png", sizes: "384x384" }],
    shortcut: BRAND_ICON,
    apple: BRAND_ICON,
  },
};

import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* ── Non-blocking font loading (preconnect + display=swap) ── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=Space+Grotesk:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <Providers>
          <Toaster />
          {children}
        </Providers>
      </body>
    </html>
  );
}
