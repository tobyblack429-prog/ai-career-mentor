"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Is 我的职业规划ai导师 really free?",
    a: "Yes. The free tier gives you access to all 5 AI agents — 1 resume audit every 2 days, 1 mock interview per week, 1 roadmap every 5 days, plus LinkedIn reviews and market scrapes. No credit card required.",
  },
  {
    q: "How does the resume ATS audit work?",
    a: "Your PDF goes through 4-layer validation (extension, MIME, magic bytes, size). Text is extracted via PDFPlumber, sanitized against prompt injection, then scored against 120+ skill aliases with date merging and 4-factor ATS scoring. You get an exact score plus specific keyword gap suggestions — not vague advice.",
  },
  {
    q: "How does the full career analysis work?",
    a: "Enter your target role and paste your resume. A parallel agent pipeline launches 4 agents concurrently — Resume Audit, Market Scraper, LinkedIn Optimizer, and Roadmap Builder. You see real-time progress logs streaming to your screen. After ~60 seconds, a complete career report appears with all 4 analyses saved to your dashboard.",
  },
  {
    q: "How does the mock interview adapt to me?",
    a: "The interview engine loads your resume from the database and tailors questions to your projects and experience. It runs a 10-phase assessment (intro, theory, deep-dive, coding, complexity, resume deep-dive, LLD, HLD, business domain, closing) with 4 difficulty tiers (Intern/Fresher/Mid/Senior). You also get a built-in Monaco code editor for live coding challenges.",
  },
  {
    q: "Can I practice for specific companies?",
    a: "Yes. The interview engine supports 164 company profiles including Google, Amazon, Microsoft, Meta, Netflix, and startups. Each company has a distinct interview style — FAANG-tier companies get harder questions, startups focus on execution speed and adaptability.",
  },
  {
    q: "What are the rate limits?",
    a: "Free tier limits protect LLM costs: 1 resume audit / 2 days, 1 roadmap / 5 days, 1 mock interview / 7 days, 1 market scrape / day, 1 LinkedIn review / day, 1 full career analysis / 7 days. Cooldown locks prevent rapid re-execution. Limits reset on fixed schedules.",
  },
  {
    q: "How is my data handled?",
    a: "Your resume is processed for analysis and saved in the local workspace database so roadmaps and interviews can reuse your context. No registration or login step is required in local workspace mode.",
  },
  {
    q: "What happens if an AI provider goes down?",
    a: "The platform uses a multi-provider failover chain. If one provider is unavailable, requests automatically route to the next — ensuring high uptime and fast responses without any action needed from you.",
  },
];

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section id="faq" className="py-28 px-6 relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-3xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 inline-block" style={{ color: "var(--accent-amber)" }}>
            Common Questions
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-black mb-6 tracking-tight leading-none" style={{ color: "var(--fg-primary)" }}>
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="overflow-hidden transition-all duration-300"
              style={{
                borderRadius: "var(--radius-xl)",
                background: "var(--bg-card)",
                border: openIdx === i ? "1px solid rgba(59,130,246,0.2)" : "1px solid var(--border-default)",
              }}
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left cursor-pointer"
              >
                <span className="text-sm font-bold pr-4" style={{ color: "var(--fg-primary)" }}>{faq.q}</span>
                <ChevronDown
                  size={16}
                  className="shrink-0 transition-transform duration-300"
                  style={{
                    color: "var(--fg-muted)",
                    transform: openIdx === i ? "rotate(180deg)" : "rotate(0deg)"
                  }}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{
                  maxHeight: openIdx === i ? "200px" : "0",
                  opacity: openIdx === i ? 1 : 0,
                }}
              >
                <p className="px-6 pb-6 text-sm leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
