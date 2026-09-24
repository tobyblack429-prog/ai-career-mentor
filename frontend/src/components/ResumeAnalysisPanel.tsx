"use client";

import { useEffect, useState } from "react";
import {
    Sparkles,
    AlertTriangle,
    User,
    Trophy,
    TrendingUp,
    Clock,
    ChevronDown,
    Target,
    CheckCircle2,
    Briefcase,
} from "lucide-react";
import type { ResumeAnalysis } from "@/types";
import { useLanguage } from "./LanguageProvider";
import { translateDynamicToChinese } from "@/i18n/translations";

interface Props {
    analysis: ResumeAnalysis;
    filename: string;
}

function SkillBadge({
    label,
    color,
    bg,
    border,
    delay = 0,
}: {
    label: string;
    color: string;
    bg: string;
    border: string;
    delay?: number;
}) {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 12px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 500,
                color,
                background: bg,
                border: `1px solid ${border}`,
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.4s ease, transform 0.4s ease",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </span>
    );
}

function SkillProgressBar({
    label,
    percent,
    color,
    delay = 0,
}: {
    label: string;
    percent: number;
    color: string;
    delay?: number;
}) {
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setWidth(percent), delay + 100);
        return () => clearTimeout(t);
    }, [percent, delay]);

    return (
        <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "13px", color: "var(--fg-secondary)", fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: "11px", color: "var(--fg-muted)" }}>{percent}%</span>
            </div>
            <div style={{ height: "6px", borderRadius: "100px", background: "var(--border-subtle)", overflow: "hidden" }}>
                <div
                    style={{
                        height: "100%",
                        width: `${width}%`,
                        background: color,
                        borderRadius: "100px",
                        transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: `0 0 8px ${color}60`,
                    }}
                />
            </div>
        </div>
    );
}

function SectionCard({
    title,
    icon: Icon,
    iconColor,
    borderColor,
    children,
}: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    borderColor: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className="glass"
            style={{ padding: "24px", borderColor, display: "flex", flexDirection: "column", gap: "16px" }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                    style={{
                        width: "34px", height: "34px", borderRadius: "10px",
                        background: `${iconColor}18`, border: `1px solid ${iconColor}30`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                >
                    <Icon size={16} color={iconColor} />
                </div>
                <h3 className="font-display" style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--fg-primary)" }}>
                    {title}
                </h3>
            </div>
            {children}
        </div>
    );
}

function skillPercent(index: number, total: number): number {
    if (total <= 1) return 95;
    return Math.round(95 - (index / (total - 1)) * 35);
}

function safeBreakdownValue(bd: any, key: string): number {
    if (!bd) return 0;
    const val = Number(bd[key]);
    return isNaN(val) ? 0 : val;
}

export default function ResumeAnalysisPanel({ analysis, filename }: Props) {
    const [expanded, setExpanded] = useState(true);
    const [mounted, setMounted] = useState(false);
    const { t, locale } = useLanguage();

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    const {
        technical_skills = [],
        soft_skills = [],
        years_of_experience = 0,
        experience_breakdown = [],
        top_strengths = [],
        skill_gaps = [],
        ats_score,
        ats_score_breakdown,
        rag_benchmarks,
    } = analysis || {};

    const bd = ats_score_breakdown || {};
    const bdKeywords = safeBreakdownValue(bd, "keywords");
    const bdAchievements = safeBreakdownValue(bd, "achievements");
    const bdActionVerbs = safeBreakdownValue(bd, "action_verbs");
    const bdFormatting = safeBreakdownValue(bd, "formatting_and_length");

    const candidateSkillsLower = technical_skills.map((s) => s.toLowerCase());
    const matchCount = rag_benchmarks
        ? rag_benchmarks.gold_standard_skills.filter((s) => candidateSkillsLower.includes(s.toLowerCase())).length
        : 0;
    const totalGoldSkills = rag_benchmarks ? rag_benchmarks.gold_standard_skills.length : 0;
    const skillMatchPercent = totalGoldSkills > 0 ? Math.round((matchCount / totalGoldSkills) * 100) : 0;
    // API/LLM values are presentation-only translations. The analysis object,
    // including scores, remains exactly as returned by the backend.
    const localizedSkill = (value: string) =>
        locale === "zh" ? translateDynamicToChinese(value, "skill") : value;
    const localizedExperience = (value: string) =>
        locale === "zh" ? translateDynamicToChinese(value, "description") : value;
    const localizedFilename = locale === "zh"
        ? translateDynamicToChinese(filename, "filename")
        : filename;
    const experienceTitle = years_of_experience <= 0
        ? t("🎓 Fresher / No Professional Experience")
        : years_of_experience < 1
            ? (() => {
                const months = Math.round(years_of_experience * 12);
                return locale === "zh"
                    ? `${months} 个月`
                    : `${months} Month${months === 1 ? "" : "s"}`;
            })()
            : locale === "zh"
                ? `${years_of_experience} 年工作经验`
                : `${years_of_experience} Years of Experience`;

    return (
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Sparkles size={18} color="var(--accent-purple)" />
                    </div>
                    <div>
                        <h2 className="font-display" style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "2px" }}>
                            {t("Resume Analysis Results")}
                        </h2>
                        <p style={{ fontSize: "12px", color: "var(--fg-muted)" }}>
                            <span data-i18n-ignore="true">{localizedFilename}</span> · {technical_skills.length + soft_skills.length} {t("skills found ·")} {years_of_experience} {t("Years")}
                        </p>
                    </div>
                </div>
                <div
                    style={{
                        padding: "8px 16px", borderRadius: "100px",
                        background: typeof ats_score === "number" && ats_score >= 80 ? "rgba(16,185,129,0.15)" : typeof ats_score === "number" && ats_score >= 60 ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                        border: `1px solid ${typeof ats_score === "number" && ats_score >= 80 ? "rgba(16,185,129,0.4)" : typeof ats_score === "number" && ats_score >= 60 ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`,
                        display: "flex", alignItems: "center", gap: "8px",
                    }}
                >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: typeof ats_score === "number" && ats_score >= 80 ? "var(--accent-emerald)" : typeof ats_score === "number" && ats_score >= 60 ? "var(--accent-amber)" : "var(--accent-rose)" }}>
                        {t("ATS Score:")} {ats_score ?? t("N/A")}/100
                    </span>
                </div>
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="btn btn-ghost"
                    style={{ gap: "6px", fontSize: "13px" }}
                >
                    {expanded ? t("Collapse") : t("Expand")}
                    <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }} />
                </button>
            </div>

            {expanded && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
                    {/* RAG Benchmarks */}
                    {rag_benchmarks && (
                        <div
                            className="glass"
                            style={{
                                gridColumn: "1 / -1", padding: "24px",
                                borderColor: "rgba(139,92,246,0.3)",
                                background: "linear-gradient(135deg, rgba(139,92,246,0.04), rgba(6,182,212,0.04))",
                                borderRadius: "16px", display: "flex", flexDirection: "column", gap: "20px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Target size={18} color="var(--accent-purple)" />
                                    </div>
                                    <div>
                                        <h3 className="font-display" style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--fg-primary)" }}>{t("RAG Target Role Alignment")}</h3>
                                        <p style={{ fontSize: "12px", color: "var(--fg-muted)" }}>{t("Benchmarked against Gold Standard criteria for the target role")}</p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                        <span style={{ fontSize: "11px", color: "var(--fg-muted)" }}>{t("Skills Match Rate")}</span>
                                        <span className="font-display" style={{ fontSize: "1.25rem", fontWeight: 700, color: skillMatchPercent >= 70 ? "var(--accent-emerald)" : skillMatchPercent >= 40 ? "var(--accent-amber)" : "var(--accent-rose)" }}>
                                            {skillMatchPercent}%
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            width: "42px", height: "42px", borderRadius: "50%",
                                            border: `3px solid ${skillMatchPercent >= 70 ? "rgba(16,185,129,0.2)" : skillMatchPercent >= 40 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
                                            borderTopColor: skillMatchPercent >= 70 ? "var(--accent-emerald)" : skillMatchPercent >= 40 ? "var(--accent-amber)" : "var(--accent-rose)",
                                            transform: "rotate(-45deg)",
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                                {/* Gold Standard Skills */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <CheckCircle2 size={14} color="var(--accent-emerald)" /> {t("Gold Standard Skills Map")}
                                    </h4>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                        {rag_benchmarks.gold_standard_skills.map((skill) => {
                                            const matches = candidateSkillsLower.includes(skill.toLowerCase());
                                            return (
                                                <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 500, color: matches ? "var(--accent-emerald)" : "var(--fg-muted)", background: matches ? "rgba(16,185,129,0.08)" : "var(--bg-surface)", border: `1px solid ${matches ? "rgba(16,185,129,0.25)" : "var(--border-subtle)"}` }}>
                                                    {matches ? "✓" : "○"} {localizedSkill(skill)}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Core Concepts & Toolchain */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                            {t("💡 Core Concepts Alignment")}
                                        </h4>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                            {rag_benchmarks.core_concepts.map((concept) => {
                                                const matches = candidateSkillsLower.includes(concept.toLowerCase()) || (technical_skills && technical_skills.some((s: string) => s.toLowerCase().includes(concept.toLowerCase())));
                                                return (
                                                    <span key={concept} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 500, color: matches ? "var(--brand)" : "var(--fg-muted)", background: matches ? "rgba(99,102,241,0.08)" : "var(--bg-surface)", border: `1px solid ${matches ? "rgba(99,102,241,0.25)" : "var(--border-subtle)"}` }}>
                                                        {matches ? "✓" : "○"} {localizedSkill(concept)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                            {t("🛠️ Required Toolchain Match")}
                                        </h4>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                            {rag_benchmarks.common_toolchain.map((tool) => {
                                                const matches = candidateSkillsLower.includes(tool.toLowerCase());
                                                return (
                                                    <span key={tool} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 500, color: matches ? "var(--accent-cyan)" : "var(--fg-muted)", background: matches ? "rgba(6,182,212,0.08)" : "var(--bg-surface)", border: `1px solid ${matches ? "rgba(6,182,212,0.25)" : "var(--border-subtle)"}` }}>
                                                        {matches ? "✓" : "○"} {localizedSkill(tool)}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Experience Benchmarks */}
                            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                                <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Briefcase size={14} color="var(--accent-cyan)" /> {t("Role Experience Expectations")}
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
                                    <div style={{ padding: "14px", borderRadius: "12px", background: years_of_experience < 3 ? "rgba(59,130,246,0.05)" : "var(--bg-surface)", border: `1px solid ${years_of_experience < 3 ? "rgba(59,130,246,0.3)" : "var(--border-subtle)"}`, position: "relative" }}>
                                        {years_of_experience < 3 && (
                                            <span style={{ position: "absolute", top: "10px", right: "12px", background: "rgba(59,130,246,0.2)", color: "var(--brand)", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "100px", border: "1px solid rgba(59,130,246,0.4)" }}>{t("Your Level Match")}</span>
                                        )}
                                        <h5 style={{ fontSize: "12px", fontWeight: 700, color: years_of_experience < 3 ? "var(--brand)" : "var(--fg-muted)", marginBottom: "6px" }}>{t("Junior Level Expectations")}</h5>
                                        <p style={{ fontSize: "12px", color: "var(--fg-secondary)", lineHeight: "1.4" }}>{localizedExperience(rag_benchmarks.experience_benchmarks.junior)}</p>
                                    </div>
                                    <div style={{ padding: "14px", borderRadius: "12px", background: years_of_experience >= 3 ? "rgba(139,92,246,0.05)" : "var(--bg-surface)", border: `1px solid ${years_of_experience >= 3 ? "rgba(139,92,246,0.3)" : "var(--border-subtle)"}`, position: "relative" }}>
                                        {years_of_experience >= 3 && (
                                            <span style={{ position: "absolute", top: "10px", right: "12px", background: "rgba(139,92,246,0.2)", color: "var(--accent-purple)", fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: "100px", border: "1px solid rgba(139,92,246,0.4)" }}>{t("Your Level Match")}</span>
                                        )}
                                        <h5 style={{ fontSize: "12px", fontWeight: 700, color: years_of_experience >= 3 ? "var(--accent-purple)" : "var(--fg-muted)", marginBottom: "6px" }}>{t("Senior Level Expectations")}</h5>
                                        <p style={{ fontSize: "12px", color: "var(--fg-secondary)", lineHeight: "1.4" }}>{localizedExperience(rag_benchmarks.experience_benchmarks.senior)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Experience Summary */}
                    <SectionCard
                        title={experienceTitle}
                        icon={Clock}
                        iconColor="var(--accent-cyan)"
                        borderColor="rgba(6,182,212,0.2)"
                    >
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: "120px", padding: "16px", borderRadius: "12px", background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)", textAlign: "center" }}>
                                <p className="gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "2.2rem", fontWeight: 800, lineHeight: 1, marginBottom: "4px" }}>
                                    {years_of_experience <= 0 ? "—" : years_of_experience < 1 ? Math.round(years_of_experience * 12) : years_of_experience}
                                </p>
                                <p style={{ fontSize: "11px", color: "var(--fg-muted)" }}>{years_of_experience <= 0 ? t("Fresher") : years_of_experience < 1 ? t("Months") : t("Years")}</p>
                            </div>
                            <div style={{ flex: 1, minWidth: "120px", padding: "16px", borderRadius: "12px", background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.15)", textAlign: "center" }}>
                                <p className="font-display" style={{ fontSize: "2.2rem", fontWeight: 800, lineHeight: 1, marginBottom: "4px", color: "var(--accent-purple)" }}>
                                    {technical_skills.length}
                                </p>
                                <p style={{ fontSize: "11px", color: "var(--fg-muted)" }}>{t("Tech Skills")}</p>
                            </div>
                            <div style={{ flex: 1, minWidth: "120px", padding: "16px", borderRadius: "12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", textAlign: "center" }}>
                                <p className="font-display" style={{ fontSize: "2.2rem", fontWeight: 800, lineHeight: 1, marginBottom: "4px", color: "var(--accent-emerald)" }}>
                                    {soft_skills.length}
                                </p>
                                <p style={{ fontSize: "11px", color: "var(--fg-muted)" }}>{t("Soft Skills")}</p>
                            </div>
                        </div>
                        {experience_breakdown && experience_breakdown.length > 0 && (
                            <div style={{ marginTop: "16px", borderTop: "1px solid rgba(6,182,212,0.15)", paddingTop: "16px" }}>
                                <p style={{ fontSize: "11px", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>{t("Detected Work Experience")}</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {experience_breakdown.map((exp, idx) => (
                                        <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "var(--fg-secondary)", lineHeight: "1.4" }}>
                                            <span style={{ color: "var(--accent-cyan)", marginTop: "2px" }}>•</span>
                                            <span>{localizedExperience(exp)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SectionCard>

                    {/* ATS Score Breakdown */}
                    {ats_score_breakdown && (
                        <SectionCard title={t("📊 ATS Score Breakdown")} icon={TrendingUp} iconColor="var(--accent-emerald)" borderColor="rgba(16,185,129,0.2)">
                            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <SkillProgressBar label={`${t("Keywords & Hard Skills")} (${bdKeywords}/35)`} percent={Math.round((bdKeywords / 35) * 100)} color="linear-gradient(90deg, var(--accent-emerald), #34d399)" delay={100} />
                                <SkillProgressBar label={`${t("Quantified Achievements")} (${bdAchievements}/30)`} percent={Math.round((bdAchievements / 30) * 100)} color="linear-gradient(90deg, var(--accent-amber), #fbbf24)" delay={200} />
                                <SkillProgressBar label={`${t("Action Verbs")} (${bdActionVerbs}/20)`} percent={Math.round((bdActionVerbs / 20) * 100)} color="linear-gradient(90deg, var(--brand), #60a5fa)" delay={300} />
                                <SkillProgressBar label={`${t("Formatting & Length")} (${bdFormatting}/15)`} percent={Math.round((bdFormatting / 15) * 100)} color="linear-gradient(90deg, var(--accent-purple), #a78bfa)" delay={400} />
                            </div>
                        </SectionCard>
                    )}

                    {/* Top Strengths */}
                    <SectionCard title={t("🏆 Top Strengths")} icon={Trophy} iconColor="var(--accent-amber)" borderColor="rgba(245,158,11,0.2)">
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {top_strengths.map((s, i) => (
                                <div
                                    key={s}
                                    style={{
                                        display: "flex", alignItems: "center", gap: "10px",
                                        padding: "10px 14px", borderRadius: "10px",
                                        background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)",
                                        opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(-12px)",
                                        transition: `opacity 0.5s ease ${i * 0.1 + 0.2}s, transform 0.5s ease ${i * 0.1 + 0.2}s`,
                                    }}
                                >
                                    <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(245,158,11,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "var(--accent-amber)", flexShrink: 0 }}>
                                        {i + 1}
                                    </span>
                                    <span style={{ fontSize: "13px", color: "var(--fg-primary)" }}>{localizedSkill(s)}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    {/* Technical Skills */}
                    <SectionCard title={t("⚡ Your Top Skills")} icon={TrendingUp} iconColor="var(--brand)" borderColor="rgba(59,130,246,0.2)">
                        <div>
                            {technical_skills.slice(0, 8).map((skill, i) => (
                                <SkillProgressBar key={skill} label={localizedSkill(skill)} percent={skillPercent(i, technical_skills.slice(0, 8).length)} color="linear-gradient(90deg, var(--brand), var(--accent-purple))" delay={i * 80} />
                            ))}
                            {soft_skills.length > 0 && (
                                <>
                                    <p style={{ fontSize: "11px", color: "var(--fg-muted)", marginTop: "16px", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("Soft Skills")}</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                        {soft_skills.map((s, i) => (
                                            <SkillBadge key={s} label={localizedSkill(s)} color="var(--accent-purple)" bg="rgba(139,92,246,0.1)" border="rgba(139,92,246,0.25)" delay={i * 60} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </SectionCard>

                    {/* Skill Gaps */}
                    <SectionCard title={t("🔴 Skill Gaps to Address")} icon={AlertTriangle} iconColor="var(--accent-rose)" borderColor="rgba(239,68,68,0.25)">
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                            {skill_gaps.map((gap, i) => (
                                <div
                                    key={gap}
                                    style={{
                                        padding: "12px 14px", borderRadius: "10px",
                                        background: i === 0 ? "rgba(239,68,68,0.08)" : i === 1 ? "rgba(249,115,22,0.07)" : "rgba(234,179,8,0.06)",
                                        border: `1px solid ${i === 0 ? "rgba(239,68,68,0.2)" : i === 1 ? "rgba(249,115,22,0.18)" : "rgba(234,179,8,0.15)"}`,
                                        opacity: mounted ? 1 : 0, transform: mounted ? "translateX(0)" : "translateX(12px)",
                                        transition: `opacity 0.5s ease ${i * 0.12 + 0.2}s, transform 0.5s ease ${i * 0.12 + 0.2}s`,
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <span style={{ fontSize: "14px", alignSelf: "flex-start", marginTop: "2px" }}>{i === 0 ? "🔴" : i === 1 ? "🟠" : "🟡"}</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--fg-primary)", marginBottom: "4px", lineHeight: "1.4" }}>{localizedSkill(gap)}</p>
                                            <p style={{ fontSize: "11px", color: "var(--fg-muted)" }}>
                                                {t(i === 0 ? "High priority (Critical for top companies)" : i === 1 ? "Medium priority (Rapidly growing demand)" : "Competitive advantage (Good to have)")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: "12px 16px", borderRadius: "10px", background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.08))", border: "1px solid rgba(139,92,246,0.15)", fontSize: "12px", color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <Sparkles size={13} color="var(--brand)" />
                            {t("Set your target role below to get a personalized roadmap to close these gaps!")}
                        </div>
                    </SectionCard>

                    {/* All Technical Skills */}
                    <SectionCard title={t("🧠 All Technical Skills Detected")} icon={User} iconColor="var(--accent-cyan)" borderColor="rgba(6,182,212,0.2)">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {technical_skills.map((s, i) => (
                                <SkillBadge key={s} label={localizedSkill(s)} color="var(--accent-cyan)" bg="rgba(6,182,212,0.08)" border="rgba(6,182,212,0.2)" delay={i * 40} />
                            ))}
                        </div>
                    </SectionCard>
                </div>
            )}
        </div>
    );
}
