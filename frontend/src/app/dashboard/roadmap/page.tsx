"use client";

import { useEffect, useState } from "react";
import { Map, Loader2, Sparkles, History } from "lucide-react";
import { toast } from "react-hot-toast";
import { generateRoadmap, getRoadmapHistory, deleteRoadmap, getMarketConfig } from "@/services/api";
import { RoadmapResponse } from "@/types";
import RoadmapPanel from "@/components/full-analysis/RoadmapPanel";
import RoadmapHistory from "@/components/full-analysis/RoadmapHistory";
import { useLanguage } from "@/components/LanguageProvider";

export default function RoadmapPage() {
  const { t, locale } = useLanguage();
  const [config, setConfig] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [customGaps, setCustomGaps] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expLevel, setExpLevel] = useState<"beginner_to_intermediate" | "intermediate_to_advanced">("intermediate_to_advanced");

  useEffect(() => {
    getMarketConfig()
      .then((data) => {
        setConfig(data);
        if (data.roles?.length) setSelectedRole(data.roles[0]);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    getRoadmapHistory()
      .then((data) => {
        if (data.history?.length > 0) {
          setHistoryList(data.history);
          const latest = data.history[0];
          setRoadmap({ id: latest.id, target_role: latest.target_role, weeks: latest.weeks });
          const roleKey = latest.target_role.toLowerCase().replace(/\s+/g, "_");
          localStorage.setItem(`roadmap_total_${roleKey}`, String(latest.weeks?.length || 8));
          setStatus("done");
        }
      })
      .catch(console.error);
  }, []);

  const [progress, setProgress] = useState({ completed: 0, total: 8 });

  useEffect(() => {
    const updateProgress = () => {
      if (!roadmap) return;
      const roleKey = roadmap.target_role ? roadmap.target_role.toLowerCase().replace(/\s+/g, "_") : "default";
      const rawCompleted = localStorage.getItem(`roadmap_completed_${roleKey}`);
      const completedArr: number[] = rawCompleted ? JSON.parse(rawCompleted) : [];
      const total = roadmap.weeks?.length || 8;
      const completed = completedArr.filter((w) => w >= 1 && w <= total).length;
      setProgress({ completed, total });
    };
    updateProgress();
    window.addEventListener("roadmapProgressUpdate", updateProgress);
    return () => window.removeEventListener("roadmapProgressUpdate", updateProgress);
  }, [roadmap]);

  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryGoal(localStorage.getItem("primary_goal_role"));
  }, [roadmap]);

  const handleSetPrimary = () => {
    if (!roadmap) return;
    const currentPrimary = localStorage.getItem("primary_goal_role");
    if (currentPrimary && currentPrimary !== roadmap.target_role) {
      alert(`${t("You have already set a primary goal for another role")} ("${currentPrimary}"). ${t("Please remove it first.")}`);
      return;
    }
    localStorage.setItem("primary_goal_role", roadmap.target_role);
    setPrimaryGoal(roadmap.target_role);
    toast.success(`${roadmap.target_role} ${t("set as Primary Goal!")}`);
  };

  const handleRemovePrimary = () => {
    localStorage.removeItem("primary_goal_role");
    setPrimaryGoal(null);
    toast.success(t("Primary Goal removed."));
  };

  const handleGenerate = async () => {
    setStatus("loading");
    let gaps = customGaps
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (gaps.length === 0) {
      gaps = locale === "zh"
        ? ["从基础到进阶的完整成长", "核心基础", "真实项目实践"]
        : ["Comprehensive Beginner to Advanced Progression", "Core Foundations", "Real-world Practical Projects"];
    }
    try {
      const result = await generateRoadmap(selectedRole, gaps, undefined, expLevel, locale);
      setRoadmap(result);
      const roleKey = result.target_role.toLowerCase().replace(/\s+/g, "_");
      localStorage.setItem(`roadmap_total_${roleKey}`, String(result.weeks?.length || 8));
      setStatus("done");
      if (typeof window !== "undefined") window.dispatchEvent(new Event("rateLimitUpdated"));
      getRoadmapHistory().then((data) => setHistoryList(data.history || []));
    } catch (err: any) {
      setStatus("error");
      toast.error(err.message || t("Failed to generate roadmap"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoadmap(id);
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
      toast.success(t("Roadmap deleted"));
    } catch {
      toast.error(t("Delete failed"));
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10" style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Map size={15} style={{ color: "var(--accent-purple)" }} />
            <span className="text-label" style={{ color: "var(--accent-purple)" }}>{t("Roadmap")}</span>
          </div>
          <h1 className="text-h1" style={{ color: "var(--fg-primary)" }}>{t("Learning Roadmaps")}</h1>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="btn btn-secondary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <History size={15} /> {t("History")}
        </button>
      </div>

      {/* Generator Card */}
      <div className="card mb-10 animate-fade-up-delay-1" style={{ padding: "28px" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div>
            <label className="text-label mb-2 block">{t("Target Role")}</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="input"
            >
              {config?.roles?.map((r: string) => (
                <option key={r} value={r} style={{ background: "var(--bg-surface)" }}>{t(r)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label mb-2 block">{t("Skill Gaps (Optional)")}</label>
            <input
              value={customGaps}
              onChange={(e) => setCustomGaps(e.target.value)}
              placeholder={locale === "zh" ? "例如：React、Docker、SQL" : "e.g. React, Docker, SQL"}
              className="input"
            />
          </div>
        </div>

        <div className="mb-6">
            <label className="text-label mb-3 block">{t("Roadmap Level")}</label>
          <div className="flex gap-3">
            {[
              { value: "beginner_to_intermediate" as const, label: t("Beginner to Intermediate"), icon: "🌱" },
              { value: "intermediate_to_advanced" as const, label: t("Intermediate to Advanced"), icon: "🚀" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setExpLevel(opt.value)}
                className="flex-1"
                style={{
                  padding: "12px",
                  borderRadius: "var(--radius-lg)",
                  border: expLevel === opt.value ? "2px solid var(--brand)" : "1px solid var(--border-default)",
                  background: expLevel === opt.value ? "rgba(59, 130, 246, 0.08)" : "var(--bg-surface)",
                  color: expLevel === opt.value ? "var(--fg-primary)" : "var(--fg-secondary)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={status === "loading"}
          className="btn btn-primary w-full"
          style={{ padding: "14px", fontSize: "0.9375rem", fontWeight: 600 }}
        >
          {status === "loading" ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {status === "loading" ? t("Architecting Curriculum...") : t("Generate Master Roadmap")}
        </button>
      </div>

      {/* Loading */}
      {status === "loading" && (
        <div className="text-center py-16">
          <Loader2 size={40} className="animate-spin mx-auto mb-4" style={{ color: "var(--brand)" }} />
          <h2 className="text-h2" style={{ color: "var(--fg-primary)" }}>{t("Synthesizing Learning Path...")}</h2>
        </div>
      )}

      {/* Results */}
      {status === "done" && roadmap && (
        <div className="animate-fade-up">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="badge badge-brand" style={{ padding: "8px 16px", fontSize: "0.8125rem" }}>
              🎯 {t("Focus:")} {t(roadmap.target_role)}
            </div>
            <div className="flex gap-3">
              {primaryGoal === roadmap.target_role ? (
                <button onClick={handleRemovePrimary} className="btn btn-danger btn-sm">
                  ✖ {t("Remove Primary Goal")}
                </button>
              ) : (
                <button onClick={handleSetPrimary} className="btn btn-sm" style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  color: "var(--accent-emerald)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                }}>
                  ⭐ {t("Set as Primary Goal")}
                </button>
              )}
            </div>
          </div>

          {/* Progress Card */}
          {(() => {
            const pct = Math.round((progress.completed / progress.total) * 100) || 0;
            let lvlName = "Novice Developer 🌱";
            let lvlColor = "#38bdf8";
            let lvlBg = "rgba(56,189,248,0.08)";
            let lvlBorder = "rgba(56,189,248,0.2)";

            if (pct > 75) {
              lvlName = "Production Ready 🏆";
              lvlColor = "var(--accent-emerald)";
              lvlBg = "rgba(16, 185, 129, 0.08)";
              lvlBorder = "rgba(16,185,129,0.2)";
            } else if (pct > 25) {
              lvlName = "SDE-1 Ready 🚀";
              lvlColor = "var(--accent-purple)";
              lvlBg = "rgba(139, 92, 246, 0.08)";
              lvlBorder = "rgba(139, 92, 246, 0.2)";
            }

            return (
              <div className="card mb-8" style={{ padding: "24px" }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--fg-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                      {t("Syllabus Coverage")}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-display font-bold" style={{ fontSize: "1.5rem", color: "var(--fg-primary)" }}>{pct}%</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--fg-muted)" }}>({progress.completed} / {progress.total} {t("Weeks")})</span>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{
                      padding: "8px 16px",
                      borderRadius: "var(--radius-full)",
                      background: lvlBg,
                      border: `1px solid ${lvlBorder}`,
                      color: lvlColor,
                      fontWeight: 600,
                      fontSize: "0.8125rem",
                    }}
                  >
                    {t("Level:")} {t(lvlName)}
                  </div>
                </div>
                <div style={{ width: "100%", height: "6px", background: "var(--border-subtle)", borderRadius: "99px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "var(--brand-gradient)",
                      borderRadius: "99px",
                      transition: "width 0.4s var(--ease-out)",
                    }}
                  />
                </div>
              </div>
            );
          })()}

          <RoadmapPanel roadmap={roadmap} />
        </div>
      )}

      {showHistory && (
        <RoadmapHistory
          history={historyList}
          onSelect={(r) => { setRoadmap(r); setShowHistory(false); setStatus("done"); }}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
