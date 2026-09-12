import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://ai-career-mentor-anil.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "CareerMentor.ai — AI Career Coach | Resume, Roadmap, Mock Interviews",
    template: "%s | CareerMentor.ai",
  },
  description:
    "Free AI-powered career platform with resume ATS auditing, personalized learning roadmaps, live market salary data, LinkedIn SEO optimization, and 10-phase mock interviews — all in one place.",
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
    title: "CareerMentor.ai — Your AI Career Co-Pilot",
    description:
      "5 specialized AI agents working together — audit your resume, build learning roadmaps, track market trends, optimize LinkedIn, and ace mock interviews.",
    url: SITE_URL,
    siteName: "CareerMentor.ai",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/icon.svg",
        width: 512,
        height: 512,
        alt: "CareerMentor.ai",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CareerMentor.ai — AI Career Co-Pilot",
    description:
      "Resume audit, learning roadmaps, market trends, LinkedIn SEO, and mock interviews — powered by AI.",
    images: ["/icon.svg"],
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
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* ── Non-blocking font loading (preconnect + display=swap) ── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;0,14..32,800;1,14..32,400&family=Space+Grotesk:wght@400;500;600;700;800&display=swap"
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
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
