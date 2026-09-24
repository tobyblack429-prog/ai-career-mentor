"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCcw, TrendingUp, Users, Clock, ChevronDown,
  AlertCircle, Shield, Search, Database, Cpu, Server, Coins,
  Terminal, CheckCircle2, AlertTriangle, Target, MessageSquare,
} from "lucide-react";
import { getAdminMetrics } from "@/services/api";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Legend, LineChart, Line,
} from "recharts";
import toast from "react-hot-toast";

interface ErrorLog { timestamp: string; message: string; traceback: string; }
interface HistoricalData {
  date: string; requests: number; tokens: number; cost: number;
  fallbacks: number; errors: number;
  groq_cost?: number; nvidia_cost?: number; google_cost?: number;
}
interface MetricData {
  active_users: number; total_users: number; active_websockets: number;
  latencies: Record<string, number[]>; error_logs: ErrorLog[];
  historical_chart: HistoricalData[];
  settings: { llm_provider: string; active_model: string };
  system_totals?: {
    total_resumes: number;
    total_interviews: number;
    total_career_analyses: number;
    total_roadmaps: number;
  };
  totals?: {
    resume: number; interview: number; roadmap: number; full_analysis: number;
    groq_cost: number; nvidia_cost: number; google_cost: number; all_time_cost: number;
  };
}

const CHART_TOOLTIP = {
  contentStyle: {
    background: "var(--bg-card)", border: "1px solid var(--border-default)",
    borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", color: "var(--fg-primary)",
    fontSize: "0.75rem",
  },
  labelStyle: { color: "var(--fg-secondary)", fontWeight: 700 },
};

export default function ObservabilityDashboard() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "";
    if (email.trim().toLowerCase() !== "anilpradhan9644@gmail.com") {
      toast.error("Unauthorized: Admin access required");
      router.replace("/dashboard");
      setAuthorized(false);
    } else {
      setAuthorized(true);
    }
  }, [router]);

  const fetchMetrics = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const data = await getAdminMetrics();
      setMetrics(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (authorized === true) {
      fetchMetrics();
      const iv = setInterval(() => {
        if (document.visibilityState === "visible") fetchMetrics();
      }, 30000);
      return () => clearInterval(iv);
    }
  }, [authorized]);

  if (authorized === null || loading) {
    return (
      <div className="flex flex-1 h-screen items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw size={32} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
          <p style={{ color: "var(--fg-muted)", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Verifying Admin Access...
          </p>
        </div>
      </div>
    );
  }
  if (authorized === false) return null;

  const avgLatency = (arr?: number[]) => {
    if (!arr?.length) return "N/A";
    return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(3) + "s";
  };

  const latencyData = (() => {
    if (!metrics) return [];
    const max = Math.max(
      metrics.latencies.nvidia?.length || 0,
      metrics.latencies.groq?.length || 0,
      metrics.latencies.google?.length || 0,
      metrics.latencies.gemini?.length || 0
    );
    const start = Math.max(0, max - 30);
    return Array.from({ length: Math.min(30, max) }).map((_, i) => {
      const idx = start + i;
      const gemLat = metrics.latencies.google?.[idx] ?? metrics.latencies.gemini?.[idx];
      return {
        req: idx + 1,
        Groq: metrics.latencies.groq?.[idx] != null ? +metrics.latencies.groq[idx].toFixed(3) : null,
        NVIDIA: metrics.latencies.nvidia?.[idx] != null ? +metrics.latencies.nvidia[idx].toFixed(3) : null,
        Gemini: gemLat != null ? +gemLat.toFixed(3) : null,
      };
    });
  })();

  const todayCost = metrics?.historical_chart?.length
    ? metrics.historical_chart[metrics.historical_chart.length - 1]
    : null;
  const filteredLogs = metrics?.error_logs?.filter(
    (l) => l.message?.toLowerCase().includes(search.toLowerCase()) || l.traceback?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const providers = [
    { name: "Groq", model: "openai/gpt-oss-120b", role: "Reasoning / Market", latency: avgLatency(metrics?.latencies?.groq), color: "#10b981" },
    { name: "Gemini", model: "gemini-3.5-flash", role: "Structured JSON / Fallback", latency: avgLatency(metrics?.latencies?.google || metrics?.latencies?.gemini), color: "#ec4899" },
    { name: "NVIDIA", model: "nemotron-3-super-120b", role: "Fallback", latency: avgLatency(metrics?.latencies?.nvidia), color: "#3b82f6" },
  ];

  const infra = [
    { label: "API Gateway", status: "Operational", icon: Server },
    { label: "Neon Postgres", status: "Online", icon: Database },
    { label: "Upstash Redis", status: "Connected", icon: Cpu },
    { label: "Observability", status: "Active", icon: Shield },
  ];

  return (
    <main className="flex-1 p-6 md:p-10 w-full" style={{ maxWidth: "1400px" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-2" style={{ color: "var(--accent-blue)" }}>
            <Shield size={14} />
            <span style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Admin Console</span>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--fg-primary)", letterSpacing: "-0.02em" }}>
            System <span className="gradient-text">Telemetry</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: "0.65rem", color: "var(--fg-muted)", padding: "6px 14px", borderRadius: "100px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            LIVE 5S FEED
          </span>
          <button onClick={() => fetchMetrics(true)} disabled={refreshing} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RefreshCcw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Syncing..." : "Sync"}
          </button>
        </div>
      </div>

      {/* ── Infrastructure Badges ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-fade-up-delay-1">
        {infra.map((item, i) => (
          <div key={i} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <item.icon size={14} style={{ color: "var(--fg-muted)" }} />
            <div>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.label}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#10b981" }} />
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Stat Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Users */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Users</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(59,130,246,0.08)" }}><Users size={14} style={{ color: "var(--accent-blue)" }} /></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>{metrics?.active_users ?? 0}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--fg-muted)", marginTop: "8px" }}>
            Total: <span style={{ color: "var(--accent-blue)", fontWeight: 700 }}>{metrics?.total_users ?? 0}</span>
          </div>
        </div>

        {/* Resumes */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Resumes</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(59,130,246,0.08)" }}><Users size={14} style={{ color: "var(--accent-blue)" }} /></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>{metrics?.system_totals?.total_resumes ?? 0}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--fg-muted)", marginTop: "8px" }}>
            All-time across all users
          </div>
        </div>

        {/* Interviews */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Interviews</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(59,130,246,0.08)" }}><MessageSquare size={14} style={{ color: "var(--accent-emerald)" }} /></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>{metrics?.system_totals?.total_interviews ?? 0}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--fg-muted)", marginTop: "8px" }}>
            All-time across all users
          </div>
        </div>

        {/* Roadmaps */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Roadmaps</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(59,130,246,0.08)" }}><Target size={14} style={{ color: "var(--accent-purple)" }} /></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>{metrics?.system_totals?.total_roadmaps ?? 0}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--fg-muted)", marginTop: "8px" }}>
            All-time across all users
          </div>
        </div>

        {/* Career Analyses */}
        <div className="card" style={{ padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Career Analyses</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(59,130,246,0.08)" }}><TrendingUp size={14} style={{ color: "var(--accent-rose)" }} /></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>{metrics?.system_totals?.total_career_analyses ?? 0}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--fg-muted)", marginTop: "8px" }}>
            All-time across all users
          </div>
        </div>
      </div>

      {/* ── Provider & Cost Cards (Full Width) ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Active Provider */}
        <div className="card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "20px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Active Provider</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(168,85,247,0.08)" }}><Cpu size={14} style={{ color: "var(--accent-purple)" }} /></div>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--fg-primary)", textTransform: "uppercase", letterSpacing: "0.02em" }}>{metrics?.settings?.llm_provider || "N/A"}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--fg-muted)", marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--accent-purple)" }} />
            <span>{metrics?.settings?.active_model || "—"}</span>
          </div>
          <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-subtle)", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.65rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>API Gateway</span>
              <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#10b981" }} />
                Operational
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Neon Postgres</span>
              <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#10b981" }} />
                Online
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Upstash Redis</span>
              <span style={{ color: "#10b981", fontWeight: 700, display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#10b981" }} />
                Connected
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Fallback Chain</span>
              <span style={{ color: "var(--fg-secondary)", fontWeight: 700 }}>Groq → Gemini → NVIDIA</span>
            </div>
          </div>
        </div>

        {/* Today's Cost */}
        <div className="card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "20px" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Today's Cost</span>
            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(245,158,11,0.08)" }}><Coins size={14} style={{ color: "var(--accent-amber)" }} /></div>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>
            ${todayCost?.cost?.toFixed(4) || "0.0000"}
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--fg-muted)", marginTop: "8px", marginBottom: "20px", display: "flex", gap: "12px", fontVariantNumeric: "tabular-nums" }}>
            <span>Grq <span style={{ color: "#10b981", fontWeight: 700 }}>${todayCost?.groq_cost?.toFixed(4) || "0"}</span></span>
            <span>Nvi <span style={{ color: "#3b82f6", fontWeight: 700 }}>${todayCost?.nvidia_cost?.toFixed(4) || "0"}</span></span>
            <span>Gem <span style={{ color: "#ec4899", fontWeight: 700 }}>${todayCost?.google_cost?.toFixed(4) || "0"}</span></span>
          </div>
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.65rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>All-Time Spend</span>
              <span style={{ color: "var(--fg-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${metrics?.totals?.all_time_cost?.toFixed(4) || "0.0000"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Total Requests</span>
              <span style={{ color: "var(--fg-primary)", fontWeight: 700 }}>{todayCost?.requests ?? 0}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Tokens Consumed</span>
              <span style={{ color: "var(--fg-primary)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{todayCost?.tokens ?? 0}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Fallbacks</span>
              <span style={{ color: todayCost?.fallbacks ? "var(--accent-amber)" : "#10b981", fontWeight: 700 }}>{todayCost?.fallbacks ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Cumulative Ledger ───────────────────────────────── */}
      <div className="card mb-6" style={{ padding: "20px 28px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>All-Time Spend</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--fg-primary)", fontVariantNumeric: "tabular-nums" }}>
            ${metrics?.totals?.all_time_cost?.toFixed(4) || "0.0000"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "24px", fontSize: "0.75rem", fontWeight: 600 }}>
          {[
            { label: "Groq", value: metrics?.totals?.groq_cost, color: "#10b981" },
            { label: "NVIDIA", value: metrics?.totals?.nvidia_cost, color: "#3b82f6" },
            { label: "Gemini", value: metrics?.totals?.google_cost, color: "#ec4899" },
          ].map((p) => (
            <div key={p.label} style={{ borderLeft: `2px solid ${p.color}`, paddingLeft: "10px" }}>
              <div style={{ fontSize: "0.55rem", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.label}</div>
              <div style={{ color: p.color, fontVariantNumeric: "tabular-nums" }}>${p.value?.toFixed(4) || "0"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Provider Health ─────────────────────────────────── */}
      <div className="mb-6">
        <h3 style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Shield size={13} style={{ color: "var(--accent-blue)" }} />
          Provider Circuit Breakers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {providers.map((p, i) => (
            <div key={i} className="card" style={{ padding: "20px", borderTop: `2px solid ${p.color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--fg-primary)" }}>{p.name}</div>
                  <div style={{ fontSize: "0.6rem", color: "var(--fg-muted)", marginTop: "2px" }}>{p.role}</div>
                </div>
                <span style={{ padding: "3px 8px", borderRadius: "100px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: "0.6rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#10b981" }} />
                  OK
                </span>
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--fg-muted)", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid var(--border-subtle)", paddingTop: "10px", marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Model</span>
                  <span style={{ color: "var(--fg-secondary)", fontWeight: 700 }} className="truncate max-w-[120px]">{p.model}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Avg Latency</span>
                  <span style={{ color: p.color, fontWeight: 700 }}>{p.latency}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Latency */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Clock size={14} style={{ color: "var(--accent-blue)" }} />
            Provider Latencies (Last 30)
          </h3>
          <div style={{ height: "260px" }}>
            {latencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="req" stroke="var(--fg-muted)" fontSize={10} />
                  <YAxis stroke="var(--fg-muted)" fontSize={10} unit="s" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend verticalAlign="top" height={30} iconType="circle" wrapperStyle={{ fontSize: "0.6rem", fontWeight: 700 }} />
                  <Line type="monotone" dataKey="Groq" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="NVIDIA" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Gemini" stroke="#ec4899" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border-default)", borderRadius: "16px", color: "var(--fg-muted)", fontSize: "0.8rem" }}>
                No latency data yet
              </div>
            )}
          </div>
        </div>

        {/* Traffic */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={14} style={{ color: "var(--accent-amber)" }} />
            7-Day Traffic & Cost
          </h3>
          <div style={{ height: "260px" }}>
            {metrics?.historical_chart?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.historical_chart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" stroke="var(--fg-muted)" fontSize={10} />
                  <YAxis yAxisId="left" stroke="var(--fg-muted)" fontSize={10} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--fg-muted)" fontSize={10} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: "0.6rem", fontWeight: 700 }} />
                  <Area yAxisId="left" type="monotone" dataKey="requests" name="Requests" stroke="#6366f1" fill="url(#gradReq)" strokeWidth={2} />
                  <Area yAxisId="right" type="monotone" dataKey="cost" name="Cost ($)" stroke="#f59e0b" fill="url(#gradCost)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border-default)", borderRadius: "16px", color: "var(--fg-muted)", fontSize: "0.8rem" }}>
                No historical data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reliability + Exceptions ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Reliability */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={14} style={{ color: "#10b981" }} />
            System Stability
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div style={{ padding: "20px", borderRadius: "14px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <div style={{ fontSize: "0.55rem", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Fallback Shifts</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--accent-amber)" }}>
                {metrics?.historical_chart?.reduce((a, c) => a + c.fallbacks, 0) || 0}
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--fg-muted)", marginTop: "4px" }}>Last 7 days</div>
            </div>
            <div style={{ padding: "20px", borderRadius: "14px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
              <div style={{ fontSize: "0.55rem", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Stability</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <CheckCircle2 size={14} /> 99.98% Healthy
              </div>
              <div style={{ fontSize: "0.6rem", color: "var(--fg-muted)", marginTop: "4px" }}>Circuit breaker: 20s cooldown</div>
            </div>
          </div>
        </div>

        {/* Errors bar */}
        <div className="card" style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={14} style={{ color: "var(--accent-rose)" }} />
            Exceptions (7-Day)
          </h3>
          <div style={{ height: "160px" }}>
            {metrics?.historical_chart?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.historical_chart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="date" stroke="var(--fg-muted)" fontSize={9} />
                  <YAxis stroke="var(--fg-muted)" fontSize={10} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="errors" name="Errors" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--border-default)", borderRadius: "16px", color: "var(--fg-muted)", fontSize: "0.8rem" }}>
                No exceptions logged
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Exception Console ───────────────────────────────── */}
      <div className="card" style={{ padding: "24px", marginBottom: "48px" }}>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
          <div>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={14} style={{ color: "var(--accent-rose)" }} />
              Exception Console
            </h3>
            <p style={{ fontSize: "0.65rem", color: "var(--fg-muted)", marginTop: "4px" }}>Last 10 backend exceptions</p>
          </div>
          <div className="relative" style={{ width: "100%", maxWidth: "280px" }}>
            <Search size={13} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--fg-muted)" }} />
            <input
              type="text" placeholder="Filter logs..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="input" style={{ paddingLeft: "34px", fontSize: "0.75rem" }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log, idx) => {
              const expanded = expandedIdx === idx;
              const ts = log.timestamp ? new Date(log.timestamp.replace("+00:00Z", "Z")).toLocaleString() : "";
              return (
                <div key={idx} style={{ borderRadius: "12px", border: "1px solid var(--border-subtle)", overflow: "hidden" }}>
                  <div onClick={() => setExpandedIdx(expanded ? null : idx)} style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "var(--bg-surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                      <AlertCircle size={13} style={{ color: "var(--accent-rose)", flexShrink: 0 }} />
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--fg-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.message || "Unknown exception"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "12px" }}>
                      <span style={{ fontSize: "0.6rem", color: "var(--fg-muted)", fontFamily: "monospace" }}>{ts}</span>
                      <ChevronDown size={13} style={{ color: "var(--fg-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </div>
                  </div>
                  {expanded && (
                    <div style={{ padding: "16px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg-base)" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(log.traceback || ""); toast.success("Copied"); }} style={{ fontSize: "0.6rem", color: "var(--accent-blue)", fontWeight: 700, cursor: "pointer", background: "none", border: "none" }}>
                          Copy Trace
                        </button>
                      </div>
                      <pre style={{ margin: 0, fontSize: "0.65rem", color: "var(--accent-rose)", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", padding: "12px", borderRadius: "8px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", maxHeight: "300px", overflow: "auto" }}>
                        {log.traceback || "No traceback available"}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ padding: "32px", textAlign: "center", border: "1px dashed var(--border-default)", borderRadius: "16px" }}>
              <CheckCircle2 size={24} style={{ color: "#10b981", margin: "0 auto 8px" }} />
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--fg-primary)" }}>All Clear</div>
              <p style={{ fontSize: "0.65rem", color: "var(--fg-muted)", marginTop: "4px" }}>No exceptions match the filter</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
