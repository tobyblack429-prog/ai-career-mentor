"use client";

import React from "react";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Showcase from "@/components/landing/Showcase";
import InterviewPrep from "@/components/landing/InterviewPrep";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CareerMentor.ai",
  description:
    "AI-powered career platform with resume ATS auditing, personalized learning roadmaps, live market salary data, LinkedIn SEO optimization, and 10-phase mock interviews.",
  url: "https://ai-career-mentor-anil.vercel.app",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
    description: "Free tier with all core AI features included",
  },
  author: {
    "@type": "Person",
    name: "Anil Pradhan",
    url: "https://my-portfolio-anil.vercel.app/",
  },
  featureList: [
    "Resume ATS Audit & Scoring",
    "Personalized Learning Roadmaps",
    "Live Market Salary Intelligence",
    "LinkedIn Profile SEO Optimization",
    "10-Phase Mock Interview Engine",
    "Full Career Analysis Pipeline",
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <main className="min-h-screen" style={{ background: "var(--bg-base)" }}>
        <div className="fixed inset-0 dot-grid -z-20 pointer-events-none opacity-30" />
        <Navbar />
        <div className="relative z-10">
          <Hero />
          <Features />
          <HowItWorks />
          <Showcase />
          <InterviewPrep />
          <Pricing />
          <FAQ />
          <CTA />
        </div>
        <Footer />
      </main>
    </>
  );
}
