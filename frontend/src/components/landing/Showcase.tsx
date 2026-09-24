"use client";

import React from "react";
import Link from "next/link";
import {
  Activity, Brain, ChevronRight, Zap, Flame, BookOpen, Trophy,
  FileText, Map, MessageSquare, TrendingUp, Target, Clock,
  BarChart, Users, Settings
} from "lucide-react";

const SIDEBAR_NAV = [
  { icon: Activity, label: "Overview", active: true },
  { icon: Brain, label: "Full Analysis", active: false },
  { icon: FileText, label: "Resume", active: false },
  { icon: Map, label: "Roadmap", active: false },
  { icon: TrendingUp, label: "Market", active: false },
  { icon: Users, label: "LinkedIn", active: false },
  { icon: MessageSquare, label: "Interview", active: false },
];

const STAT_CARDS = [
  { icon: Zap, value: "0", label: "Today's Actions", color: "var(--accent-purple)" },
  { icon: Flame, value: "0", label: "Day Streak", color: "var(--accent-amber)" },
  { icon: BookOpen, value: "6", label: "Roadmaps", color: "var(--accent-cyan)" },
  { icon: Trophy, value: "8", label: "Analyses", color: "var(--accent-emerald)" },
];

const WEEKLY_ENGAGEMENT = [
  { label: "Mon", val: 0 }, { label: "Tue", val: 0 }, { label: "Wed", val: 85 },
  { label: "Thu", val: 0 }, { label: "Fri", val: 0 }, { label: "Sat", val: 0 }, { label: "Sun", val: 0 },
];

const FEATURE_QUOTAS = [
  { icon: FileText, label: "Resume Scans", used: 0, total: 1, limit: "1 ATS Audit / day", lock: "2-Day Gap Lock", color: "#3b82f6" },
  { icon: Map, label: "Roadmaps", used: 0, total: 1, limit: "1 Syllabus / day", lock: "5-Day Gap Lock", color: "#8b5cf6" },
  { icon: MessageSquare, label: "Mock Interviews", used: 0, total: 1, limit: "1 Session / day", lock: "7-Day Gap Lock", color: "#06b6d4" },
  { icon: TrendingUp, label: "Market Trends", used: 0, total: 1, limit: "1 Intel Report / day", lock: "12h Scraper Cache", color: "#10b981" },
  { icon: Target, label: "AI Analysis", used: 0, total: 1, limit: "1 Full DAG / day", lock: "7-Day Gap Lock", color: "#f59e0b" },
  { icon: Users, label: "LinkedIn Builder", used: 0, total: 1, limit: "1 Strategy / day", lock: "24h Daily Reset", color: "#6366f1" },
];

const RECENT_ACTIVITY = [
  { label: "Started Mock Interview for Software Engineer", time: "11:49 AM", color: "var(--accent-amber)" },
  { label: "Executed Streamed Career Analysis for Computer Vision Engin...", time: "11:19 AM", color: "var(--accent-cyan)" },
  { label: "Started Mock Interview for Software Engineer", time: "11:09 AM", color: "var(--accent-amber)" },
  { label: "Executed Streamed Career Analysis for Generative AI / LLM En...", time: "11:08 AM", color: "var(--accent-cyan)" },
  { label: "Started Mock Interview for Software Engineer", time: "09:15 AM", color: "var(--accent-amber)" },
];

const ANALYSIS_HISTORY = [
  { label: "Executed Streamed Career Analysis for Comput...", date: "19 Aug 2026", color: "var(--accent-cyan)" },
  { label: "Executed Streamed Career Analysis for Generati...", date: "19 Aug 2026", color: "var(--accent-cyan)" },
  { label: "Executed Streamed Career Analysis for Softwar...", date: "12 Aug 2026", color: "var(--accent-cyan)" },
  { label: "Executed Streamed Career Analysis for Softwar...", date: "12 Aug 2026", color: "var(--accent-cyan)" },
  { label: "Executed Streamed Career Analysis for Softwar...", date: "30 Jun 2026", color: "var(--accent-cyan)" },
  { label: "Executed Streamed Career Analysis for Softwar...", date: "30 Jun 2026", color: "var(--accent-cyan)" },
];

const INTERVIEW_SCORES = [
  { x: "#1", y: 10 }, { x: "#2", y: 45 }, { x: "#3", y: 65 },
  { x: "#4", y: 78 }, { x: "#5", y: 82 }, { x: "#6", y: 85 }, { x: "#7", y: 80 },
];

const WEEKLY_PROGRESS = [
  { label: "W1", val: 0 }, { label: "W2", val: 0 }, { label: "W3", val: 90 }, { label: "W4", val: 45 },
];

const RADAR_POINTS = [
  { label: "ATS", angle: 0, pct: 0.35 },
  { label: "Keywords", angle: 72, pct: 0.55 },
  { label: "Impact", angle: 144, pct: 0.45 },
  { label: "Verbs", angle: 216, pct: 0.3 },
  { label: "Format", angle: 288, pct: 0.25 },
];

function MiniRadar() {
  const cx = 100, cy = 100, maxR = 60;
  const rings = [0.25, 0.5, 0.75, 1];
  const toXY = (angle: number, pct: number) => ({
    x: cx + maxR * pct * Math.cos((angle - 90) * Math.PI / 180),
    y: cy + maxR * pct * Math.sin((angle - 90) * Math.PI / 180),
  });
  const dataPath = RADAR_POINTS.map((p, i) => {
    const pt = toXY(p.angle, p.pct);
    return `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`;
  }).join(" ") + " Z";

  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {rings.map((r, i) => (
        <polygon key={i} points={RADAR_POINTS.map(p => {
          const pt = toXY(p.angle, r);
          return `${pt.x},${pt.y}`;
        }).join(" ")} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      {RADAR_POINTS.map((p, i) => {
        const pt = toXY(p.angle, 1);
        return <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />;
      })}
      <polygon points={dataPath} fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth="1.5" />
      {RADAR_POINTS.map((p, i) => {
        const pt = toXY(p.angle, 1.15);
        return <text key={i} x={pt.x} y={pt.y} textAnchor="middle" fill="var(--fg-muted)" fontSize="8" fontWeight="600">{p.label}</text>;
      })}
    </svg>
  );
}

function LineChart() {
  const w = 400, h = 140, pad = { t: 10, r: 10, b: 25, l: 30 };
  const chartW = w - pad.l - pad.r, chartH = h - pad.t - pad.b;
  const maxY = 100;

  const pts = INTERVIEW_SCORES.map((s, i) => ({
    x: pad.l + (i / (INTERVIEW_SCORES.length - 1)) * chartW,
    y: pad.t + chartH - (s.y / maxY) * chartH,
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const gradPath = `${path} L ${pts[pts.length - 1].x} ${pad.t + chartH} L ${pts[0].x} ${pad.t + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {[0, 25, 50, 75, 100].map((v, i) => {
        const y = pad.t + chartH - (v / maxY) * chartH;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
            <text x={pad.l - 5} y={y + 3} textAnchor="end" fill="var(--fg-muted)" fontSize="8" fontWeight="600">{v}</text>
          </g>
        );
      })}
      <path d={gradPath} fill="url(#greenGrad)" opacity="0.15" />
      <path d={path} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#10b981" />
      ))}
      {INTERVIEW_SCORES.map((s, i) => (
        <text key={i} x={pts[i].x} y={h - 5} textAnchor="middle" fill="var(--fg-muted)" fontSize="8" fontWeight="600">{s.x}</text>
      ))}
      <defs>
        <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function BarChartMini({ data, color }: { data: { label: string; val: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.val), 1);
  return (
    <div className="flex items-end justify-around h-full px-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-1">
          <div className="w-3.5 rounded-t h-full flex items-end overflow-hidden" style={{ background: "var(--bg-muted)" }}>
            <div className="w-full rounded-t" style={{ height: `${(d.val / max) * 100}%`, background: color }} />
          </div>
          <span className="text-[8px] font-bold" style={{ color: "var(--fg-muted)" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Showcase() {
  return (
    <section id="demo" className="py-28 px-6 relative" style={{ background: "var(--bg-base)" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(0,0,0,0.3)" }} />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 inline-block" style={{ color: "var(--brand)" }}>
            Live Dashboard Preview
          </span>
          <h2 className="font-display text-4xl sm:text-5xl font-black mb-4 tracking-tighter" style={{ color: "var(--fg-primary)" }}>
            Your Career <span className="gradient-text">Command Center</span>
          </h2>
          <p className="max-w-xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            A real-time view of your AI agents, usage limits, progress analytics, and activity trace.
          </p>
        </div>

        {/* Dashboard Container */}
        <div className="relative p-[2px] rounded-[2rem] overflow-hidden" style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.12), transparent)"
        }}>
          <div className="rounded-[1.9rem] flex overflow-hidden" style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            minHeight: "700px"
          }}>

            {/* Sidebar */}
            <div className="w-56 shrink-0 p-4 flex flex-col justify-between hidden lg:flex" style={{
              background: "var(--bg-surface)",
              borderRight: "1px solid var(--border-subtle)"
            }}>
              <div>
                <div className="flex items-center gap-2.5 mb-8 px-2">
                  <img src="/icon.svg" alt="CareerMentor.ai" className="w-8 h-8 object-contain shrink-0" />
                  <div>
                    <span className="font-display font-black text-xs tracking-tight leading-none block" style={{ color: "var(--fg-primary)" }}>
                      CareerMentor<span style={{ color: "var(--brand)" }}>.ai</span>
                    </span>
                    <span className="text-[7px] font-bold uppercase tracking-widest mt-0.5 block" style={{ color: "var(--fg-muted)" }}>AI Career Coach</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  {SIDEBAR_NAV.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold transition-all" style={{
                      background: item.active ? "rgba(59,130,246,0.08)" : "transparent",
                      color: item.active ? "var(--brand)" : "var(--fg-muted)",
                      border: item.active ? "1px solid rgba(59,130,246,0.12)" : "1px solid transparent"
                    }}>
                      <item.icon size={14} />
                      <span>{item.label}</span>
                      {item.active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand)" }} />}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[11px] font-semibold" style={{ color: "var(--fg-muted)" }}>
                  <Settings size={14} />
                  <span>Settings</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1 rounded-lg" style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "var(--brand)", color: "#fff" }}>AN</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold truncate" style={{ color: "var(--fg-primary)" }}>Local User</div>
                    <div className="text-[8px] font-medium" style={{ color: "var(--fg-muted)" }}>Local workspace</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-y-auto" style={{ background: "var(--bg-card)" }}>

              {/* Header */}
              <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.15em] uppercase mb-2" style={{ color: "var(--brand)" }}>
                <Activity size={12} />
                <span>Dashboard</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-1" style={{ color: "var(--fg-primary)" }}>
                Good evening, <span className="gradient-text">Anilpradhan</span>
              </h3>
              <p className="text-xs mb-6" style={{ color: "var(--fg-muted)" }}>Here&apos;s an overview of your career progress and activity.</p>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {STAT_CARDS.map((stat, i) => (
                  <div key={i} className="p-4" style={{
                    borderRadius: "var(--radius-xl)",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)"
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon size={14} style={{ color: stat.color }} />
                    </div>
                    <div className="text-2xl font-black" style={{ color: "var(--fg-primary)" }}>{stat.value}</div>
                    <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--fg-muted)" }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Weekly Engagement */}
                <div className="p-4" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1.5">
                      <BarChart size={12} style={{ color: "var(--fg-muted)" }} />
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>Weekly Engagement</span>
                    </div>
                    <span className="text-[9px] font-bold" style={{ color: "var(--accent-cyan)" }}>Today: 0</span>
                  </div>
                  <div className="h-32">
                    <BarChartMini data={WEEKLY_ENGAGEMENT} color="linear-gradient(to top, #7c3aed, #d946ef)" />
                  </div>
                </div>

                {/* Aptitude Radar */}
                <div className="p-4" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity size={12} style={{ color: "var(--fg-muted)" }} />
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>Aptitude Radar</span>
                  </div>
                  <div className="h-36">
                    <MiniRadar />
                  </div>
                </div>

                {/* Goal Trajectory */}
                <div className="p-4 flex flex-col" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="flex items-center gap-1.5 mb-4">
                    <Target size={12} style={{ color: "var(--fg-muted)" }} />
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>Goal Trajectory</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <div className="relative">
                      <svg width="100" height="100" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.04)" strokeWidth="6" fill="none" />
                        <circle cx="50" cy="50" r="40" stroke="url(#goalGrad)" strokeWidth="7" fill="none"
                          strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - 0.38)} strokeLinecap="round"
                          transform="rotate(-90 50 50)" />
                        <defs>
                          <linearGradient id="goalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#7c3aed" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-black" style={{ color: "var(--fg-primary)" }}>38%</span>
                        <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>Mastery</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-xs font-bold mt-2" style={{ color: "var(--fg-primary)" }}>Backend Developer</div>
                </div>
              </div>

              {/* Interview Score + Weekly Progress */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="md:col-span-2 p-4" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="flex items-center gap-1.5 mb-4">
                    <Trophy size={12} className="text-amber-500" />
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>Interview Score Trend</span>
                  </div>
                  <div className="h-32">
                    <LineChart />
                  </div>
                </div>

                <div className="p-4" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="flex items-center gap-1.5 mb-4">
                    <BarChart size={12} className="text-purple-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>Weekly Progress · This Month</span>
                  </div>
                  <div className="h-32">
                    <BarChartMini data={WEEKLY_PROGRESS} color="#8b5cf6" />
                  </div>
                </div>
              </div>

              {/* Daily Quotas + Activity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Feature Quotas */}
                <div className="md:col-span-2 p-5" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Zap size={14} style={{ color: "var(--accent-amber)" }} />
                      <span className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--fg-primary)" }}>Daily Feature Quotas</span>
                    </div>
                    <span className="text-[9px] font-bold px-2.5 py-1 rounded-full" style={{
                      background: "rgba(59,130,246,0.08)",
                      border: "1px solid rgba(59,130,246,0.15)",
                      color: "var(--brand)"
                    }}>0 / 6 used today</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {FEATURE_QUOTAS.map((q, i) => (
                      <div key={i} className="p-3" style={{
                        borderRadius: "var(--radius-lg)",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)"
                      }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{
                              background: `color-mix(in srgb, ${q.color} 10%, transparent)`,
                            }}>
                              <q.icon size={13} style={{ color: q.color }} />
                            </div>
                            <span className="text-[10px] font-black" style={{ color: "var(--fg-primary)" }}>{q.label}</span>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-md" style={{
                            background: `${q.color}15`,
                            color: q.color
                          }}>{q.used} / {q.total}</span>
                        </div>
                        <div className="w-full h-1 rounded-full mb-2" style={{ background: "var(--bg-muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(q.used / q.total) * 100}%`, background: q.color }} />
                        </div>
                        <div className="flex items-center justify-between text-[8px] font-medium" style={{ color: "var(--fg-muted)" }}>
                          <span>{q.limit}</span>
                          <span className="flex items-center gap-1"><Clock size={8} /> {q.lock}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 text-[9px] font-medium" style={{ color: "var(--fg-muted)" }}>
                    <span className="w-3 h-3 rounded-full flex items-center justify-center text-[7px]" style={{ background: "rgba(59,130,246,0.1)", color: "var(--brand)" }}>?</span>
                    <span>Quotas reset daily at 00:00 UTC. Cooldown locks protect free tier resources.</span>
                    <span className="ml-auto font-bold" style={{ color: "var(--fg-secondary)" }}>Free Tier</span>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="p-5" style={{
                  borderRadius: "var(--radius-xl)",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <span className="text-[9px] font-black uppercase tracking-wider block mb-4" style={{ color: "var(--fg-secondary)" }}>Recent Activity</span>
                  <div className="space-y-4">
                    {RECENT_ACTIVITY.map((log, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: log.color }} />
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold leading-tight truncate" style={{ color: "var(--fg-secondary)" }}>{log.label}</div>
                          <div className="text-[8px] font-bold mt-0.5 uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>{log.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Career Analysis History */}
              <div className="p-5 mb-4" style={{
                borderRadius: "var(--radius-xl)",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)"
              }}>
                <div className="flex items-center gap-1.5 mb-4">
                  <Clock size={12} style={{ color: "var(--fg-muted)" }} />
                  <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--fg-secondary)" }}>Full Career Analysis History</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ANALYSIS_HISTORY.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)"
                    }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{
                        background: "rgba(6,182,212,0.08)",
                        border: "1px solid rgba(6,182,212,0.15)"
                      }}>
                        <Brain size={14} style={{ color: "var(--accent-cyan)" }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold truncate" style={{ color: "var(--fg-secondary)" }}>{h.label}</div>
                        <div className="text-[8px] font-medium mt-0.5" style={{ color: "var(--fg-muted)" }}>{h.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <div className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>Powered by Multi-Provider AI Engine</div>
                <Link href="/dashboard" className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all" style={{
                  color: "#fff",
                  background: "var(--brand-gradient)",
                  border: "1px solid rgba(59,130,246,0.2)"
                }}>
                  Try It Free <ChevronRight size={10} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
