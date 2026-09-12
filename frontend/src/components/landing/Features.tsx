"use client";

import React from "react";
import { Activity, Target, TrendingUp, MessageSquare, Code, BrainCircuit } from "lucide-react";

const FEATURES = [
  {
    title: "ATS Auditing Engine",
    desc: "Deterministic keyword parsing and OCR noise removal. Computes true ATS scores matching 50,000+ benchmark specifications with actionable rewrite suggestions.",
    icon: Target,
    color: "var(--accent-emerald)",
  },
  {
    title: "Syllabus RAG Planner",
    desc: "Queries gold-standard learning resources via vector similarity search. Generates weekly roadmaps with prerequisites, hands-on projects, and practice tests.",
    icon: Activity,
    color: "var(--accent-purple)",
  },
  {
    title: "Mock Interview Engine",
    desc: "Interactive text-based interviews with real-time streaming feedback. Runs under a strict 10-phase FSM with an integrated coding sandbox.",
    icon: Code,
    color: "var(--brand)",
  },
  {
    title: "Market Intelligence",
    desc: "Concurrently scrapes job platforms and salary trends. Normalizes salary metrics across global currencies and filters outdated templates automatically.",
    icon: TrendingUp,
    color: "var(--accent-cyan)",
  },
  {
    title: "LinkedIn Profile SEO",
    desc: "Audits keyword density, re-keys headlines for recruiter search indexing, and generates section-by-section rewrite strategies using enterprise LLM pipelines.",
    icon: MessageSquare,
    color: "var(--accent-amber)",
  },
  {
    title: "Full Career Analysis",
    desc: "A coordinated multi-agent pipeline that cross-references your resume, roadmap, and live market data into one unified career plan.",
    icon: BrainCircuit,
    color: "var(--accent-rose)",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-28 px-6 relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="absolute pointer-events-none" style={{ top: "33%", left: "50%", transform: "translateX(-50%)", width: "800px", height: "800px", background: "radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)", filter: "blur(180px)" }} />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 inline-block" style={{ color: "var(--brand)" }}>
            Platform Capabilities
          </span>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-black mb-6 tracking-tight leading-none" style={{ color: "var(--fg-primary)" }}>
            Everything You Need to <span className="gradient-text">Succeed</span>
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            Five specialized AI agents working together to accelerate every stage of your career journey
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="group relative p-8 transition-all duration-300 flex flex-col min-h-[260px] overflow-hidden"
              style={{
                borderRadius: "var(--radius-2xl)",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)"
              }}
            >
              {/* Corner Glow */}
              <div
                className="absolute -right-16 -top-16 w-36 h-36 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: `color-mix(in srgb, ${f.color} 15%, transparent)` }}
              />

              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: `color-mix(in srgb, ${f.color} 8%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${f.color} 15%, transparent)`,
                  color: f.color
                }}
              >
                <f.icon size={20} />
              </div>

              <h3 className="text-lg font-bold mb-3 tracking-tight" style={{ color: "var(--fg-primary)" }}>
                {f.title}
              </h3>

              <p className="leading-relaxed text-sm flex-1" style={{ color: "var(--fg-secondary)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
