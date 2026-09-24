import React from "react";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "SDE-2 at Amazon",
    text: "The ATS audit in 我的职业规划ai导师 found 14 keyword gaps in my resume. After fixing them, I got callbacks from 3 FAANG companies in one week.",
    rating: 5,
    color: "var(--brand)",
  },
  {
    name: "Rahul Verma",
    role: "ML Engineer at NVIDIA",
    text: "The mock interview engine is scarily accurate. It asked me the exact system design question I got in my real Google interview. Landed the offer.",
    rating: 5,
    color: "var(--accent-purple)",
  },
  {
    name: "Ananya Patel",
    role: "Full Stack Dev at Microsoft",
    text: "The roadmap agent built a 12-week plan that perfectly bridged my React gaps to a senior role. The market salary data was spot on for Bangalore.",
    rating: 5,
    color: "var(--accent-emerald)",
  },
];

export default function Testimonials() {
  return (
    <section className="py-28 px-6 relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="absolute pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(59,130,246,0.03) 0%, transparent 70%)", filter: "blur(140px)" }} />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 inline-block" style={{ color: "var(--accent-emerald)" }}>
            Success Stories
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-black mb-6 tracking-tight leading-none" style={{ color: "var(--fg-primary)" }}>
            Loved by <span className="gradient-text">Developers</span>
          </h2>
          <p className="max-w-xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            Real results from developers who used 我的职业规划ai导师 to land their dream roles
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={i}
              className="p-8 transition-all duration-300 flex flex-col"
              style={{
                borderRadius: "var(--radius-2xl)",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)"
              }}
            >
              {/* Stars */}
              <div className="flex items-center gap-1 mb-5">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} size={14} fill="var(--accent-amber)" style={{ color: "var(--accent-amber)" }} />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: "var(--fg-secondary)" }}>
                &ldquo;{t.text}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm" style={{
                  background: `color-mix(in srgb, ${t.color} 12%, transparent)`,
                  color: t.color
                }}>
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-xs font-bold" style={{ color: "var(--fg-primary)" }}>{t.name}</div>
                  <div className="text-[10px] font-medium" style={{ color: "var(--fg-muted)" }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
