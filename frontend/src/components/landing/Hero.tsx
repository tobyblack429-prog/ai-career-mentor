import React from "react";
import Link from "next/link";
import { ArrowRight, Play, Shield, Zap, CheckCircle2 } from "lucide-react";

const TRUST_BADGES = [
  { icon: Shield, label: "Enterprise Grade Security" },
  { icon: Zap, label: "Multi-Provider AI Engine" },
  { icon: CheckCircle2, label: "100% Free to Start" },
];

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "4rem 4rem",
        maskImage: "radial-gradient(ellipse 60% 50% at 50% 0%, #000 70%, transparent 100%)"
      }} />

      {/* Ambient Glows */}
      <div className="absolute pointer-events-none" style={{ top: 0, left: "25%", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", filter: "blur(120px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: 0, right: "25%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)", filter: "blur(100px)" }} />

      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8" style={{
          background: "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)"
        }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10b981" }} />
          <span className="text-[11px] font-bold tracking-wide" style={{ color: "var(--fg-secondary)" }}>
            Multi-Agent AI Platform — Now in Open Beta
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.08] mb-6 tracking-tight" style={{ color: "var(--fg-primary)" }}>
          Your Complete AI{" "}
          <span className="gradient-text">Career Co-Pilot</span>
          <br />
          <span className="text-3xl sm:text-4xl md:text-5xl" style={{ color: "var(--fg-secondary)" }}>
            From Resume Scan to Hired.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: "var(--fg-secondary)" }}>
          Five specialized AI agents working in concert — auditing your resume, building personalized learning roadmaps, tracking live market trends, optimizing your LinkedIn presence, and running interactive mock interviews with real-time feedback.
        </p>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-10">
          {TRUST_BADGES.map((badge, i) => (
            <div key={i} className="flex items-center gap-2">
              <badge.icon size={14} style={{ color: "#10b981" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--fg-muted)" }}>{badge.label}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link
            href="/dashboard"
            className="btn btn-primary w-full sm:w-auto"
            style={{ padding: "16px 36px", fontSize: "0.8rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            <span>Get Started for Free</span>
            <ArrowRight size={15} />
          </Link>
          <a
            href="#demo"
            onClick={(e) => { e.preventDefault(); document.querySelector("#demo")?.scrollIntoView({ behavior: "smooth" }); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            style={{
              color: "var(--fg-secondary)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)"
            }}
          >
            <Play size={13} />
            <span>See How It Works</span>
          </a>
        </div>

        {/* Social Proof Line */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {["bg-blue-500", "bg-purple-500", "bg-cyan-500", "bg-emerald-500"].map((bg, i) => (
              <div key={i} className={`w-7 h-7 rounded-full ${bg} border-2`} style={{ borderColor: "var(--bg-base)" }} />
            ))}
          </div>
          <span className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>
            Trusted by <span style={{ color: "var(--fg-secondary)", fontWeight: 700 }}>100+</span> developers worldwide
          </span>
        </div>
      </div>
    </section>
  );
}
