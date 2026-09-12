import React from "react";
import { Upload, Cpu, BarChart, FileText, Map, TrendingUp, Target, MessageSquare } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Resume",
    desc: "Drop your PDF. Our 4-layer validation (extension, MIME, magic bytes, size) extracts text via PDFPlumber, strips injection attempts, and runs a deterministic ATS audit matching 120+ skill aliases.",
    color: "var(--brand)",
    details: ["PDF text extraction", "ATS keyword scoring", "Skill gap detection"],
  },
  {
    number: "02",
    icon: Cpu,
    title: "5 AI Agents Analyze in Parallel",
    desc: "A parallel DAG fans out 4 agents concurrently — Resume Audit, Market Scraper, LinkedIn Optimizer, and Roadmap Builder — while the Mock Interview Engine runs independently via WebSocket.",
    color: "var(--accent-purple)",
    details: ["Parallel agent orchestration", "Real-time SSE streaming", "~60s total latency"],
  },
  {
    number: "03",
    icon: BarChart,
    title: "Get Your Unified Career Plan",
    desc: "Receive a complete report: ATS optimization tips, 8-week RAG roadmap with curated resources, location-aware salary benchmarks, LinkedIn headline strategy, and a 10-phase mock interview scorecard.",
    color: "var(--accent-emerald)",
    details: ["All 5 agents in one report", "Saved to your dashboard", "Track progress over time"],
  },
];

const PIPELINE = [
  { icon: FileText, label: "Resume Audit", sub: "ATS + LLM hybrid scoring", color: "var(--brand)" },
  { icon: Map, label: "Roadmap Builder", sub: "8-week RAG syllabus", color: "var(--accent-purple)" },
  { icon: TrendingUp, label: "Market Explorer", sub: "Live salary & job data", color: "var(--accent-cyan)" },
  { icon: Target, label: "LinkedIn SEO", sub: "Headline & keyword strategy", color: "var(--accent-emerald)" },
  { icon: MessageSquare, label: "Mock Interview", sub: "10-phase FSM + Monaco editor", color: "var(--accent-rose)" },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6 relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="absolute pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(139,92,246,0.04) 0%, transparent 70%)", filter: "blur(140px)" }} />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 inline-block" style={{ color: "var(--accent-purple)" }}>
            Platform Architecture
          </span>
          <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-black mb-6 tracking-tight leading-none" style={{ color: "var(--fg-primary)" }}>
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            From resume upload to career clarity in three steps — powered by a parallel agent orchestration engine coordinating 5 specialized AI agents.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative mb-24">
          {/* Connecting Line */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px" style={{ background: "linear-gradient(to right, var(--brand), var(--accent-purple), var(--accent-emerald))", opacity: 0.2 }} />

          {STEPS.map((step, i) => (
            <div key={i} className="relative text-center">
              {/* Step Number */}
              <div className="relative inline-flex items-center justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative z-10" style={{
                  background: `color-mix(in srgb, ${step.color} 8%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${step.color} 20%, transparent)`,
                }}>
                  <step.icon size={24} style={{ color: step.color }} />
                </div>
                <span className="absolute -top-2 -right-2 text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{
                  background: step.color,
                  color: "#000"
                }}>{step.number}</span>
              </div>

              <h3 className="text-lg font-bold mb-3 tracking-tight" style={{ color: "var(--fg-primary)" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed max-w-sm mx-auto mb-4" style={{ color: "var(--fg-secondary)" }}>
                {step.desc}
              </p>

              {/* Detail Tags */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                {step.details.map((d, j) => (
                  <span key={j} className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{
                    background: `color-mix(in srgb, ${step.color} 6%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${step.color} 12%, transparent)`,
                    color: step.color
                  }}>{d}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Agent Pipeline */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "4rem" }}>
          <div className="text-center mb-12">
            <h3 className="font-display text-2xl sm:text-3xl font-black mb-3 tracking-tight" style={{ color: "var(--fg-primary)" }}>
              5 Specialized AI Agents
            </h3>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--fg-muted)" }}>
              Each agent is purpose-built for a single career domain, sharing context through a unified pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {PIPELINE.map((agent, i) => (
              <div key={i} className="p-5 text-center transition-all duration-300 hover:-translate-y-1" style={{
                borderRadius: "var(--radius-xl)",
                background: "var(--bg-card)",
                border: `1px solid color-mix(in srgb, ${agent.color} 12%, var(--border-default))`
              }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{
                  background: `color-mix(in srgb, ${agent.color} 8%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${agent.color} 15%, transparent)`,
                }}>
                  <agent.icon size={18} style={{ color: agent.color }} />
                </div>
                <div className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "var(--fg-primary)" }}>{agent.label}</div>
                <div className="text-[10px] font-medium" style={{ color: "var(--fg-muted)" }}>{agent.sub}</div>
              </div>
            ))}
          </div>

          {/* Architecture Note */}
          <div className="mt-8 p-5 text-center" style={{
            borderRadius: "var(--radius-xl)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)"
          }}>
            <p className="text-xs font-bold" style={{ color: "var(--fg-muted)" }}>
              <span style={{ color: "var(--accent-purple)" }}>Parallel Agent DAG</span> — Resume + Market fan-out concurrently, then LinkedIn + Roadmap fan-in. Total latency: ~60s instead of ~4min sequential. Mock Interview runs independently via WebSocket with a 10-phase FSM.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
