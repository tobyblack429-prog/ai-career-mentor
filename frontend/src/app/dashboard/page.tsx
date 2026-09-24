"use client";

import { useEffect, useState } from "react";
import {
  Zap, Target, Activity, Sparkles, LayoutDashboard,
  TrendingUp, Flame, BookOpen, Trophy, History, BrainCircuit,
  FileText, Map, MessageSquare, Clock,
  Lock, HelpCircle,
} from "lucide-react";
import { getUserStats } from "@/services/api";
import { useLanguage } from "@/components/LanguageProvider";
import { formatDisplayName } from "@/utils/formatName";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  LineChart, Line, CartesianGrid,
} from "recharts";

const FEATURE_LIMIT_CONFIG = [
  { key: "resume", label: "Resume Scans", shortDesc: "1 ATS Audit / day", icon: FileText, dailyCap: 1, cooldownRule: "2-Day Gap Lock", color: "#3b82f6", bgGlow: "rgba(59, 130, 246, 0.12)" },
  { key: "roadmap", label: "Roadmaps", shortDesc: "1 Syllabus / day", icon: Map, dailyCap: 1, cooldownRule: "5-Day Gap Lock", color: "#8b5cf6", bgGlow: "rgba(139, 92, 246, 0.12)" },
  { key: "interview", label: "Mock Interviews", shortDesc: "1 Session / day", icon: MessageSquare, dailyCap: 1, cooldownRule: "7-Day Gap Lock", color: "#06b6d4", bgGlow: "rgba(6, 182, 212, 0.12)" },
  { key: "market", label: "Market Trends", shortDesc: "1 Intel Report / day", icon: TrendingUp, dailyCap: 1, cooldownRule: "12h Scraper Cache", color: "#10b981", bgGlow: "rgba(16, 185, 129, 0.12)" },
  { key: "full_analysis", label: "AI Analysis", shortDesc: "1 Full DAG / day", icon: BrainCircuit, dailyCap: 1, cooldownRule: "7-Day Gap Lock", color: "#f59e0b", bgGlow: "rgba(245, 158, 11, 0.12)" },
  { key: "linkedin", label: "LinkedIn Builder", shortDesc: "1 Strategy / day", icon: Target, dailyCap: 1, cooldownRule: "24h Daily Reset", color: "#6366f1", bgGlow: "rgba(99, 102, 241, 0.12)" },
];

function formatCountdown(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [userName, setUserName] = useState("Local User");
  const [usageData, setUsageData] = useState<Record<string, number>>({});
  const [gapBlocks, setGapBlocks] = useState<Record<string, number>>({});
  const [activityLog, setActivityLog] = useState<{ label: string; time: string; color: string }[]>([]);
  const [skillRadar, setSkillRadar] = useState<{ skill: string; score: number }[] | null>(null);
  const [weeklyActivity, setWeeklyActivity] = useState<{ day: string; actions: number }[]>([]);
  const [monthlyActivity, setMonthlyActivity] = useState<{ week: string; actions: number }[]>([]);
  const [primaryGoal, setPrimaryGoal] = useState<{ role: string; pct: number; totalWeeks: number } | null>(null);
  const [todayHighScore, setTodayHighScore] = useState<number | null>(null);
  const [allInterviewScores, setAllInterviewScores] = useState<{ score: number; date: string }[]>([]);
  const [streak, setStreak] = useState(0);
  const [roadmapCount, setRoadmapCount] = useState(0);
  const [analysisHistory, setAnalysisHistory] = useState<{ action: string; created_at: string }[]>([]);
  const [todayActionCount, setTodayActionCount] = useState(0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  useEffect(() => {
    const storedName = localStorage.getItem("userName") || "";
    const storedEmail = localStorage.getItem("userEmail") || "";
    const displayName = storedName && storedName !== "Administrator"
      ? storedName
      : storedEmail
        ? formatDisplayName(storedEmail.split("@")[0])
        : "Local User";
    setUserName(displayName);

    const loadStats = () => {
      getUserStats()
        .then(stats => {
          setUsageData(stats.usageToday || {});
          setGapBlocks(stats.gapBlocks || {});
          setActivityLog(stats.activityLog || []);
          setTodayActionCount(stats.todayActionCount || 0);
          setStreak(stats.streak || 0);
          setRoadmapCount(stats.roadmapHistory?.length || 0);
          setAnalysisHistory(stats.analysisHistory || []);
          if (stats.weeklyActivity) setWeeklyActivity(stats.weeklyActivity);
          if (stats.monthlyActivity) setMonthlyActivity(stats.monthlyActivity);

          if (stats.interviewHistory?.length) {
            const todayStr = new Date().toDateString();
            const todays = stats.interviewHistory.filter((h: any) => new Date(h.created_at).toDateString() === todayStr);
            if (todays.length > 0) setTodayHighScore(Math.max(...todays.map((h: any) => h.score || 0)));
            setAllInterviewScores(
              stats.interviewHistory.slice(0, 8).reverse().map((h: any, i: number) => ({ score: Math.round(h.score || 0), date: `#${i + 1}` }))
            );
          }

          let parsed = stats.lastResumeAnalysis;
          if (parsed) {
            try {
              if (typeof parsed === "string") parsed = JSON.parse(parsed);
              const a = parsed?.analysis || parsed;
              const b = a?.ats_score_breakdown || {};
              setSkillRadar([
                { skill: "ATS", score: Math.min(100, Number(a?.ats_score || 0)) },
                { skill: "Keywords", score: Number(b.keywords ?? 0) },
                { skill: "Impact", score: Number(b.achievements ?? 0) },
                { skill: "Verbs", score: Number(b.action_verbs ?? 0) },
                { skill: "Format", score: Number(b.formatting_and_length ?? 0) },
              ]);
            } catch {}
          }

          const storedRole = localStorage.getItem("primary_goal_role");
          if (storedRole && stats.roadmapHistory?.length) {
            const roadmap = stats.roadmapHistory.find((r: any) => r.target_role === storedRole) || null;
            if (roadmap) {
              const roleKey = roadmap.target_role.toLowerCase().replace(/\s+/g, "_");
              const raw = localStorage.getItem(`roadmap_completed_${roleKey}`);
              const completed = raw ? JSON.parse(raw).length : 0;
              const total = Math.max(roadmap.weeks?.length || 0, 1);
              localStorage.setItem(`roadmap_total_${roleKey}`, String(total));
              setPrimaryGoal({ role: roadmap.target_role, pct: Math.min(100, Math.round((completed / total) * 100)), totalWeeks: total });
            }
          }
        })
        .catch(console.error);
    };
    loadStats();
    window.addEventListener("rateLimitUpdated", loadStats);
    return () => window.removeEventListener("rateLimitUpdated", loadStats);
  }, []);

  useEffect(() => {
    const handler = () => {
      setPrimaryGoal(prev => {
        if (!prev) return prev;
        const roleKey = prev.role.toLowerCase().replace(/\s+/g, "_");
        const raw = localStorage.getItem(`roadmap_completed_${roleKey}`);
        const completed = raw ? JSON.parse(raw).length : 0;
        return { ...prev, pct: Math.min(100, Math.round((completed / prev.totalWeeks) * 100)) };
      });
    };
    window.addEventListener("roadmapProgressUpdate", handler);
    window.addEventListener("storage", handler);
    return () => { window.removeEventListener("roadmapProgressUpdate", handler); window.removeEventListener("storage", handler); };
  }, []);

  return (
    <div className="p-5 md:p-6 lg:p-8" style={{ maxWidth: "1400px" }}>
      {/* Header */}
      <div className="mb-6 animate-fade-up">
        <div className="flex items-center gap-2 mb-2">
          <LayoutDashboard size={13} style={{ color: "var(--brand)" }} />
          <span className="text-label-brand">Dashboard</span>
        </div>
        <h1 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, color: "var(--fg-primary)", letterSpacing: "-0.03em" }}>
          {greeting}, <span className="gradient-text">{userName}</span>
        </h1>
        <p className="mt-1" style={{ color: "var(--fg-muted)", fontSize: "0.8125rem" }}>
          Here's an overview of your career progress and activity.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid mb-6 animate-fade-up-delay-1">
        {[
          { label: "Today's Actions", value: todayActionCount, icon: <Zap size={14} />, color: "var(--brand)" },
          { label: "Day Streak", value: streak, icon: <Flame size={14} />, color: "var(--accent-amber)" },
          { label: "Roadmaps", value: roadmapCount, icon: <BookOpen size={14} />, color: "var(--accent-cyan)" },
          { label: "Analyses", value: analysisHistory.length, icon: <BrainCircuit size={14} />, color: "var(--accent-emerald)" },
        ].map((stat, i) => (
          <div key={i} className="card" style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-md)", background: `${stat.color}12`, display: "flex", alignItems: "center", justifyContent: "center", color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <div className="font-display font-bold" style={{ fontSize: "1.25rem", color: "var(--fg-primary)", lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: "0.625rem", color: "var(--fg-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "2px" }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 animate-fade-up-delay-2">
        {/* Weekly Activity */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="text-label">Weekly Engagement</span>
            <span className="ml-auto text-2xs font-semibold" style={{ color: "var(--brand)" }}>Today: {todayActionCount}</span>
          </div>
          <div style={{ height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyActivity} barCategoryGap="25%">
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--fg-muted)", fontSize: 10 }} />
                <Tooltip cursor={{ fill: "var(--bg-hover)" }} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", fontSize: "0.75rem" }} />
                <Bar dataKey="actions" radius={[3, 3, 0, 0]}>
                  {weeklyActivity.map((_, idx) => (
                    <Cell key={idx} fill={idx === weeklyActivity.length - 1 ? "#3b82f6" : "rgba(59, 130, 246, 0.15)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Skill Radar */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="text-label">Aptitude Radar</span>
          </div>
          <div style={{ height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              {skillRadar && skillRadar.length > 0 ? (
                <RadarChart data={skillRadar}>
                  <PolarGrid stroke="var(--border-subtle)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--fg-muted)", fontSize: 9 }} />
                  <Radar dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.12} strokeWidth={1.5} />
                </RadarChart>
              ) : (
                <RadarChart data={[{ skill: "ATS", score: 0 }, { skill: "Keywords", score: 0 }, { skill: "Impact", score: 0 }, { skill: "Verbs", score: 0 }, { skill: "Format", score: 0 }]}>
                  <PolarGrid stroke="var(--border-subtle)" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--fg-disabled)", fontSize: 9 }} />
                  <Radar dataKey="score" stroke="var(--fg-disabled)" fill="transparent" strokeWidth={1} />
                </RadarChart>
              )}
            </ResponsiveContainer>
          </div>
          {(!skillRadar || skillRadar.length === 0) && (
            <p className="text-center mt-1" style={{ fontSize: "0.625rem", color: "var(--fg-muted)" }}>Upload a resume to unlock</p>
          )}
        </div>

        {/* Goal Trajectory */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Target size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="text-label">Goal Trajectory</span>
          </div>
          <div className="flex flex-col items-center justify-center" style={{ height: "200px" }}>
            {primaryGoal ? (
              <>
                <div className="relative" style={{ width: "140px", height: "140px" }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="font-display font-bold" style={{ fontSize: "1.75rem", color: "var(--fg-primary)", lineHeight: 1 }}>{primaryGoal.pct}%</div>
                      <div style={{ fontSize: "0.5625rem", color: "var(--fg-muted)", textTransform: "uppercase", fontWeight: 600, marginTop: "3px", letterSpacing: "0.06em" }}>Mastery</div>
                    </div>
                  </div>
                  <svg className="absolute inset-0" style={{ transform: "rotate(-90deg)" }} width="140" height="140">
                    <circle cx="70" cy="70" r="62" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
                    <circle cx="70" cy="70" r="62" fill="none" stroke="url(#g1)" strokeWidth="8" strokeDasharray={`${(primaryGoal.pct / 100) * 390} 390`} strokeLinecap="round" />
                    <defs><linearGradient id="g1"><stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
                  </svg>
                </div>
                <p className="mt-3 font-medium" style={{ fontSize: "0.8125rem", color: "var(--fg-primary)" }}>{primaryGoal.role}</p>
              </>
            ) : (
              <div className="text-center" style={{ opacity: 0.3 }}>
                <Zap size={32} className="mx-auto mb-3" />
                <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)" }}>No Target Set</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4 animate-fade-up-delay-3">
        {/* Interview Trend */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="text-label">Interview Score Trend</span>
          </div>
          <div style={{ height: "200px" }}>
            {allInterviewScores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={allInterviewScores}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "var(--fg-muted)", fontSize: 10 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--fg-muted)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", fontSize: "0.75rem" }} formatter={(v: any) => [`${v}/100`, "Score"]} />
                  <defs><linearGradient id="g2"><stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
                  <Line type="monotone" dataKey="score" stroke="url(#g2)" strokeWidth={2} dot={{ fill: "#10b981", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#3b82f6" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full" style={{ opacity: 0.25 }}>
                <Trophy size={32} className="mb-3" />
                <p style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-muted)" }}>Complete interviews to see your trend</p>
              </div>
            )}
          </div>
          {todayHighScore !== null && (
            <p className="mt-2 text-right" style={{ fontSize: "0.6875rem", color: "var(--fg-muted)" }}>
              Today's best: <span className="font-semibold" style={{ color: "var(--accent-emerald)" }}>{todayHighScore}/100</span>
            </p>
          )}
        </div>

        {/* Monthly Progress */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="text-label">Weekly Progress · This Month</span>
          </div>
          <div style={{ height: "200px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyActivity.length ? monthlyActivity : [{ week: "W1", actions: 0 }, { week: "W2", actions: 0 }, { week: "W3", actions: 0 }, { week: "W4", actions: 0 }]} barCategoryGap="30%">
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: "var(--fg-muted)", fontSize: 10, fontWeight: 600 }} />
                <Tooltip cursor={{ fill: "var(--bg-hover)" }} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", fontSize: "0.75rem" }} />
                <Bar dataKey="actions" radius={[4, 4, 0, 0]}>
                  {[0, 1, 2, 3].map(i => (
                    <Cell key={i} fill={["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7"][i]} fillOpacity={[0.8, 0.6, 0.5, 0.4][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-4 animate-fade-up-delay-3">
        {/* Usage Limits */}
        <div className="card lg:col-span-3 flex flex-col justify-between" style={{ padding: "20px" }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60 font-sans">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-indigo-400" />
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 font-sans tracking-tight">Daily Feature Quotas</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium text-slate-300 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                {FEATURE_LIMIT_CONFIG.reduce((acc, f) => acc + ((usageData[f.key] || 0) >= f.dailyCap ? 1 : (usageData[f.key] || 0)), 0)} / 6 used today
              </span>
            </div>
          </div>

          {/* 6 Feature Cards Grid - Spacious 2 columns so titles never truncate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
            {FEATURE_LIMIT_CONFIG.map(f => {
              const used = usageData[f.key] || 0;
              const limit = f.dailyCap;
              const pct = Math.min(100, Math.round((used / limit) * 100));
              const isUsed = used >= limit;
              const gapSeconds = gapBlocks[f.key];
              const isLocked = gapSeconds != null;

              return (
                <div
                  key={f.key}
                  className="flex flex-col justify-between p-3.5 rounded-xl border transition-all duration-200"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: isLocked ? "rgba(244, 63, 94, 0.35)" : isUsed ? "rgba(245, 158, 11, 0.3)" : "var(--border-subtle)",
                  }}
                >
                  {/* Top Row: Icon + Title + Count Pill */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: f.bgGlow,
                          border: `1px solid ${f.color}35`,
                          color: f.color,
                        }}
                      >
                        <f.icon size={14} />
                      </div>
                      <span className="text-xs font-semibold text-slate-200 font-sans tracking-tight whitespace-nowrap">
                        {f.label}
                      </span>
                    </div>

                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                        isLocked
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/25"
                          : isUsed
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-slate-900/80 text-slate-300 border-slate-800"
                      }`}
                    >
                      {isLocked ? "LOCKED" : `${used} / ${limit}`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden my-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isLocked
                          ? "linear-gradient(90deg, #f43f5e, #ef4444)"
                          : isUsed
                            ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                            : f.color,
                      }}
                    />
                  </div>

                  {/* Bottom Subtext Line */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span className="text-slate-400 font-sans font-normal">{f.shortDesc}</span>
                    {isLocked ? (
                      <span className="font-mono text-[10px] flex items-center gap-1" style={{ color: "var(--accent-rose)" }}>
                        <Lock size={10} /> unlocks in {formatCountdown(gapSeconds)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
                        <Clock size={10} className="text-slate-400" /> {f.cooldownRule}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Info Notice */}
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/40 flex items-center justify-between text-[11px] font-sans text-slate-400">
            <span className="flex items-center gap-1.5">
              <HelpCircle size={12} className="text-indigo-400 shrink-0" />
              Quotas reset daily at 00:00 UTC. Cooldown locks protect free tier resources.
            </span>
            <span className="font-mono text-[10px] text-slate-400 font-medium">Free Tier</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card lg:col-span-2" style={{ padding: "20px" }}>
          <span className="text-label mb-4 block">Recent Activity</span>
          <div className="flex flex-col gap-2">
            {activityLog.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: a.color || "var(--brand)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-primary)" }}>{t(a.label)}</div>
                  <div style={{ fontSize: "0.625rem", color: "var(--fg-muted)" }}>{new Date(a.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
            {activityLog.length === 0 && (
              <p className="text-center py-6" style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>No operations logged yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Analysis History */}
      {analysisHistory.length > 0 && (
        <div className="card animate-fade-up" style={{ padding: "20px" }}>
          <div className="flex items-center gap-2 mb-4">
            <History size={13} style={{ color: "var(--fg-muted)" }} />
            <span className="text-label">Full Career Analysis History</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {analysisHistory.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-center gap-3" style={{ padding: "12px 14px", borderRadius: "var(--radius-lg)", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                <BrainCircuit size={14} style={{ color: "var(--accent-cyan)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-primary)" }}>{a.action}</div>
                  <div style={{ fontSize: "0.625rem", color: "var(--fg-muted)", marginTop: "1px" }}>
                    {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
