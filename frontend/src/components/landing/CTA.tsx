import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function CTA() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="relative overflow-hidden" style={{
          borderRadius: "var(--radius-2xl)",
          border: "1px solid var(--border-default)"
        }}>
          <div className="absolute inset-0" style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 50%, var(--bg-card) 100%)"
          }} />
          <div className="absolute pointer-events-none" style={{ top: 0, left: "33%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", filter: "blur(100px)" }} />
          <div className="absolute pointer-events-none" style={{ bottom: 0, right: "25%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)", filter: "blur(80px)" }} />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 px-10 py-14 sm:px-16 sm:py-16">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{
                background: "var(--brand-gradient)",
                boxShadow: "0 0 30px rgba(59,130,246,0.2)"
              }}>
                <Sparkles className="text-white" size={24} />
              </div>
              <div>
                <h3 className="font-display text-2xl sm:text-3xl font-black tracking-tight mb-2" style={{ color: "var(--fg-primary)" }}>
                  Ready to Accelerate Your Career?
                </h3>
                <p className="text-sm max-w-lg leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                  Join developers who are using 我的职业规划ai导师 to target roles at tech leaders. Free to start — no credit card required.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="btn btn-primary shrink-0"
              style={{ padding: "16px 32px", fontSize: "0.75rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}
            >
              <span>Get Started Now</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
