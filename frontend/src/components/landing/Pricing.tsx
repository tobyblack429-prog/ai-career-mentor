"use client";

import React from "react";
import { Check, ArrowRight, Zap, Shield, Clock, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

const FREE_FEATURES = [
  { text: "1 Resume Audit / 2 days", highlight: false },
  { text: "1 Mock Interview / 7 days", highlight: false },
  { text: "1 Learning Roadmap / 5 days", highlight: false },
  { text: "1 Full Career Analysis / 7 days", highlight: false },
  { text: "1 LinkedIn Review / day", highlight: false },
  { text: "1 Market Scrape / day", highlight: false },
  { text: "164 Company-Specific Interview Sim", highlight: false },
  { text: "Monaco Code Editor Sandbox", highlight: false },
  { text: "4 Role-Level Difficulty Tiers", highlight: false },
  { text: "10-Phase Structured Interview", highlight: false },
];

const PRO_FEATURES = [
  { text: "10x usage limits across all agents", highlight: true },
  { text: "Priority API Routing (Zero Wait)", highlight: false },
  { text: "Real-Time Audio Interview Feedback", highlight: false },
  { text: "Export Reports as PDF", highlight: false },
  { text: "Advanced Market Salary Breakdown", highlight: false },
  { text: "Resume Version Tracking & Diff", highlight: false },
  { text: "Custom Learning Path Duration", highlight: false },
  { text: "Early Access to New Features", highlight: false },
];

const TRUST_ITEMS = [
  { icon: Shield, text: "No credit card required" },
  { icon: Clock, text: "Cancel anytime" },
  { icon: Users, text: "Join 100+ developers" },
];

export default function Pricing() {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [isPremium, setIsPremium] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setIsLoggedIn(!!localStorage.getItem("token"));
    setIsPremium(localStorage.getItem("user_tier") === "premium");
  }, []);

  const handlePlanClick = (planId: string) => {
    if (planId === "free") {
      if (isLoggedIn) {
        router.push("/dashboard");
      } else {
        router.push("/register");
      }
    } else {
      toast("The Premium Pro tier is currently under development. Coming soon!", {
        icon: "⚡",
        duration: 5000,
        style: {
          background: "#0a0a0a",
          color: "#ededed",
          border: "1px solid rgba(139, 92, 246, 0.2)",
          borderRadius: "12px",
        }
      });
    }
  };

  return (
    <section id="pricing" className="py-28 px-6 relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      <div className="absolute pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)", filter: "blur(140px)" }} />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 inline-block" style={{ color: "var(--accent-emerald)" }}>
            Pricing
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-black mb-6 tracking-tight leading-none" style={{ color: "var(--fg-primary)" }}>
            Start Free. <span className="gradient-text">Upgrade When Ready.</span>
          </h2>
          <p className="max-w-xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            Get full access to all 5 AI agents. Free tier includes all core features — no credit card required.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-8">
          {/* Free Plan */}
          <div className="relative p-8 flex flex-col" style={{
            borderRadius: "var(--radius-2xl)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
          }}>
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--fg-primary)" }}>Free</h3>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Everything you need to get started</p>
            </div>

            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-black font-display tracking-tighter" style={{ color: "var(--fg-primary)" }}>₹0</span>
              <span className="text-xs font-bold" style={{ color: "var(--fg-muted)" }}>/forever</span>
            </div>

            <button
              onClick={() => handlePlanClick("free")}
              disabled={mounted && isLoggedIn && !isPremium}
              className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 mb-8"
              style={{
                background: mounted && isLoggedIn && !isPremium ? "var(--bg-muted)" : "var(--bg-surface)",
                color: mounted && isLoggedIn && !isPremium ? "var(--fg-muted)" : "var(--fg-primary)",
                border: "1px solid var(--border-default)",
                cursor: mounted && isLoggedIn && !isPremium ? "not-allowed" : "pointer",
                opacity: mounted && isLoggedIn && !isPremium ? 0.6 : 1,
              }}
            >
              {mounted && isLoggedIn && !isPremium ? "Current Plan" : "Get Started Free"}
            </button>

            <div className="space-y-3 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>What&apos;s included</span>
              {FREE_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Check size={13} strokeWidth={3} style={{ color: "var(--accent-emerald)" }} />
                  <span className="text-xs font-medium" style={{ color: "var(--fg-secondary)" }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Plan */}
          <div className="relative p-8 flex flex-col" style={{
            borderRadius: "var(--radius-2xl)",
            background: "var(--bg-card)",
            border: "1px solid rgba(139,92,246,0.3)",
            boxShadow: "0 0 60px rgba(139,92,246,0.06)"
          }}>
            {/* Badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{
                background: "var(--brand-gradient)",
              }}>
                <Zap size={11} className="text-white" />
                <span className="text-[10px] font-black uppercase tracking-wider text-white">Most Popular</span>
              </div>
            </div>

            <div className="mb-6 mt-2">
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2" style={{ color: "var(--fg-primary)" }}>
                Pro
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{
                  background: "rgba(139,92,246,0.1)",
                  color: "var(--accent-purple)"
                }}>10x Limits</span>
              </h3>
              <p className="text-xs" style={{ color: "var(--fg-muted)" }}>For serious career preparation</p>
            </div>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-4xl font-black font-display tracking-tighter" style={{ color: "var(--fg-primary)" }}>₹349</span>
              <span className="text-xs font-bold" style={{ color: "var(--fg-muted)" }}>/month</span>
            </div>
            <div className="text-[10px] font-bold mb-6" style={{ color: "var(--fg-muted)" }}>~$4.19 USD / month</div>

            <button
              onClick={() => handlePlanClick("pro")}
              disabled={mounted && isPremium}
              className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 mb-8"
              style={{
                background: mounted && isPremium ? "var(--bg-muted)" : "var(--brand-gradient)",
                color: mounted && isPremium ? "var(--fg-muted)" : "#fff",
                border: "none",
                cursor: mounted && isPremium ? "not-allowed" : "pointer",
                opacity: mounted && isPremium ? 0.6 : 1,
                boxShadow: mounted && isPremium ? "none" : "0 4px 20px rgba(139,92,246,0.3)",
              }}
            >
              {mounted && isPremium ? "Active Plan" : (
                <>Upgrade to Pro <ArrowRight size={13} /></>
              )}
            </button>

            <div className="space-y-3 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Everything in Free, plus</span>
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Check size={13} strokeWidth={3} style={{ color: f.highlight ? "var(--accent-purple)" : "var(--accent-emerald)" }} />
                  <span className="text-xs font-medium" style={{ color: f.highlight ? "var(--fg-primary)" : "var(--fg-secondary)" }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Trust Line */}
        <div className="flex items-center justify-center gap-6 mb-12">
          {TRUST_ITEMS.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <item.icon size={13} style={{ color: "var(--fg-muted)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="max-w-3xl mx-auto" style={{
          borderRadius: "var(--radius-2xl)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          overflow: "hidden"
        }}>
          <div className="p-6" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--fg-primary)" }}>Compare Plans</h3>
          </div>

          <div className="p-6">
            {[
              { feature: "Resume Audits", free: "1 / 2 days", pro: "10 / 2 days" },
              { feature: "Mock Interviews", free: "1 / 7 days", pro: "10 / 7 days" },
              { feature: "Learning Roadmaps", free: "1 / 5 days", pro: "10 / 5 days" },
              { feature: "Full Career Analysis", free: "1 / 7 days", pro: "10 / 7 days" },
              { feature: "LinkedIn Reviews", free: "1 / day", pro: "10 / day" },
              { feature: "Market Scrapes", free: "1 / day", pro: "10 / day" },
              { feature: "164 Company Interview Sim", free: true, pro: true },
              { feature: "Monaco Code Editor", free: true, pro: true },
              { feature: "Role-Level Difficulty (4 Tiers)", free: true, pro: true },
              { feature: "Priority API Routing", free: false, pro: true },
              { feature: "Real-Time Audio Feedback", free: false, pro: true },
              { feature: "Export Reports as PDF", free: false, pro: true },
              { feature: "Resume Version Tracking", free: false, pro: true },
            ].map((row, i) => (
              <div key={i} className="flex items-center py-3 text-xs" style={{
                borderBottom: i < 12 ? "1px solid var(--border-subtle)" : "none"
              }}>
                <span className="flex-1 font-medium" style={{ color: "var(--fg-secondary)" }}>{row.feature}</span>
                <span className="w-24 text-center font-medium" style={{ color: "var(--fg-muted)" }}>
                  {typeof row.free === "boolean" ? (
                    row.free ? <Check size={14} className="mx-auto" style={{ color: "var(--accent-emerald)" }} /> : <span style={{ color: "var(--fg-muted)" }}>—</span>
                  ) : row.free}
                </span>
                <span className="w-24 text-center font-bold" style={{ color: "var(--accent-purple)" }}>
                  {typeof row.pro === "boolean" ? (
                    row.pro ? <Check size={14} className="mx-auto" style={{ color: "var(--accent-emerald)" }} /> : <span>—</span>
                  ) : row.pro}
                </span>
              </div>
            ))}
            <div className="flex items-center pt-3">
              <span className="flex-1" />
              <span className="w-24 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>Free</span>
              <span className="w-24 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent-purple)" }}>Pro</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
