import React, { useState, useEffect } from "react";
import { Roadmap } from "@/types";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, Circle, Clock, Lightbulb, Terminal, Award, FileText, BookOpen, Search, Check, HelpCircle, BookmarkCheck } from "lucide-react";
import { toggleRoadmapWeek } from "@/services/api";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/LanguageProvider";
import { translateDynamicToChinese } from "@/i18n/translations";

interface Props {
    roadmap: Roadmap;
}

const YoutubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" stroke="currentColor" fill="currentColor" strokeWidth="0" {...props}>
        <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
);

const GithubIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" stroke="currentColor" fill="currentColor" strokeWidth="0" {...props}>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
);

const safeString = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    if (typeof val === "boolean") return val ? "Yes" : "No";
    if (typeof val === "number") return String(val);
    if (Array.isArray(val)) return val.map(v => safeString(v)).join(". ");
    if (typeof val === "object") {
        return Object.entries(val as Record<string, unknown>)
            .map(([k, v]) => {
                const key = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                return typeof v === "boolean" ? (v ? key : "") : `${key}: ${safeString(v)}`;
            })
            .filter(Boolean)
            .join(". ");
    }
    return String(val);
};

const RoadmapPanel: React.FC<Props> = ({ roadmap }) => {
    const { t, locale } = useLanguage();
    const display = (value: string, kind: "skill" | "description" = "description") => locale === "zh" ? translateDynamicToChinese(value, kind) : value;
    const [completedWeeks, setCompletedWeeks] = useState<Record<number, boolean>>({});

    useEffect(() => {
        if (!roadmap || !roadmap.weeks) return;
        const initialStates: Record<number, boolean> = {};
        let hasDbState = false;
        const dbCompletedWeeks: number[] = [];
        roadmap.weeks.forEach(w => {
            if (w.completed !== undefined) {
                initialStates[w.week] = !!w.completed;
                if (w.completed) dbCompletedWeeks.push(w.week);
                hasDbState = true;
            }
        });
        const roleKey = roadmap.target_role ? roadmap.target_role.toLowerCase().replace(/\s+/g, "_") : "default";
        if (hasDbState) {
            localStorage.setItem(`roadmap_completed_${roleKey}`, JSON.stringify(dbCompletedWeeks));
            window.dispatchEvent(new Event("roadmapProgressUpdate"));
        } else {
            const rawCompleted = localStorage.getItem(`roadmap_completed_${roleKey}`);
            const completedArr: number[] = rawCompleted ? JSON.parse(rawCompleted) : [];
            completedArr.forEach(w => { initialStates[w] = true; });
        }
        setCompletedWeeks(initialStates);
    }, [roadmap]);

    const toggleComplete = async (weekNum: number, forceCompleted?: boolean) => {
        const isNowComplete = forceCompleted !== undefined ? forceCompleted : !completedWeeks[weekNum];
        setCompletedWeeks(prev => ({ ...prev, [weekNum]: isNowComplete }));
        const roleKey = roadmap.target_role ? roadmap.target_role.toLowerCase().replace(/\s+/g, "_") : "default";
        if (roadmap.id) {
            try {
                await toggleRoadmapWeek(roadmap.id, weekNum, isNowComplete);
            } catch (err) {
                console.error("Syncing progress to DB failed", err);
                toast.error(t("Failed to sync progress with database"));
            }
        }
        const rawCompleted = localStorage.getItem(`roadmap_completed_${roleKey}`);
        let completedArr: number[] = rawCompleted ? JSON.parse(rawCompleted) : [];
        if (isNowComplete) {
            if (!completedArr.includes(weekNum)) completedArr.push(weekNum);
        } else {
            completedArr = completedArr.filter(w => w !== weekNum);
        }
        localStorage.setItem(`roadmap_completed_${roleKey}`, JSON.stringify(completedArr));
        window.dispatchEvent(new Event("roadmapProgressUpdate"));
    };

    if (!roadmap || !roadmap.weeks) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade-up">
            {roadmap.weeks.map((week, i) => {
                const isCompleted = !!completedWeeks[week.week];
                return (
                    <div
                        key={i}
                        className="card"
                        style={{
                            padding: "20px 24px",
                            background: isCompleted ? "var(--bg-card)" : "var(--bg-card)",
                            border: isCompleted ? "1px solid rgba(16,185,129,0.2)" : "1px solid var(--border-default)",
                            position: "relative",
                            overflow: "hidden",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                    >
                        {/* Accent Bar */}
                        <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: isCompleted ? "linear-gradient(to bottom, var(--accent-emerald), #34d399)" : "linear-gradient(to bottom, var(--accent-purple), var(--accent-cyan))", transition: "all 0.3s ease" }} />

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                            <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                                <button onClick={() => toggleComplete(week.week)} className="btn btn-ghost btn-icon" style={{ marginTop: "4px", color: isCompleted ? "var(--accent-emerald)" : "var(--fg-muted)" }} title={isCompleted ? t("Mark as incomplete") : t("Mark as complete")}>
                                    {isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                                <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px", flexWrap: "wrap" }}>
                                        <span className="font-display" style={{ fontSize: "0.7rem", fontWeight: 800, color: isCompleted ? "var(--accent-emerald)" : "var(--accent-purple)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                                            {t(`Week ${week.week}`)}
                                        </span>
                                        <span style={{ color: "var(--fg-muted)", fontSize: "0.7rem" }}>•</span>
                                        {week.skill_gap_addressed && (
                                            <div style={{ display: "inline-flex", padding: "1px 6px", background: isCompleted ? "rgba(16,185,129,0.08)" : "rgba(168,85,247,0.08)", borderRadius: "4px", color: isCompleted ? "var(--accent-emerald)" : "var(--accent-purple)", fontSize: "0.65rem", fontWeight: 700 }}>
                                                {t("Targeting:")} {display(safeString(week.skill_gap_addressed), "skill")}
                                            </div>
                                        )}
                                    </div>
                                    <h3 className="font-display" style={{ color: isCompleted ? "var(--fg-muted)" : "var(--fg-primary)", fontSize: "1.2rem", fontWeight: 750, margin: 0, letterSpacing: "-0.01em", transition: "color 0.3s ease", textDecoration: isCompleted ? "line-through" : "none" }}>
                                        {display(safeString(week.topic), "skill")}
                                    </h3>
                                </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {isCompleted && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "100px", color: "var(--accent-emerald)", fontSize: "0.7rem", fontWeight: 700 }}>
                                        <Check size={10} strokeWidth={3} /> {t("Completed")}
                                    </div>
                                )}
                                <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 10px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "100px", color: "var(--fg-secondary)", fontWeight: 600, fontSize: "0.75rem" }}>
                                    <Clock size={10} style={{ color: "var(--accent-cyan)" }} />
                                    <span>{week.estimated_hours} {t("Hours")}</span>
                                </div>
                            </div>
                        </div>

                        {week.why_it_matters && (
                            <div style={{ color: "var(--fg-secondary)", fontSize: "0.85rem", lineHeight: 1.5, margin: "10px 0 14px 32px", background: "rgba(56,189,248,0.02)", padding: "10px 14px", borderRadius: "10px", borderLeft: "3px solid var(--accent-cyan)", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                <Lightbulb size={16} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: "2px" }} />
                                <div><strong>{t("Why it matters:")}</strong> {display(safeString(week.why_it_matters))}</div>
                            </div>
                        )}

                        {week.prerequisites && week.prerequisites.length > 0 && (
                            <div style={{ margin: "0 0 14px 32px", padding: "12px 16px", background: "linear-gradient(135deg, rgba(251,191,36,0.04) 0%, rgba(245,158,11,0.02) 100%)", border: "1px solid rgba(251,191,36,0.12)", borderRadius: "12px" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--accent-amber)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <BookmarkCheck size={12} />
                                    <span>{t("Prerequisites — Know Before You Start")}</span>
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                    {week.prerequisites.map((prereq: string, idx: number) => (
                                        <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "100px", fontSize: "0.75rem", color: "var(--fg-secondary)", fontWeight: 500 }}>
                                            <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "rgba(251,191,36,0.15)", color: "var(--accent-amber)", fontSize: "0.6rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{idx + 1}</span>
                                            {display(prereq, "skill")}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ margin: "0 0 16px 32px" }}>
                            <div style={{ padding: "14px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--fg-muted)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Terminal size={12} style={{ color: "var(--accent-purple)" }} />
                                    <span>{t("Capstone Project")}</span>
                                </div>
                                <div className="markdown-content" style={{ color: "var(--fg-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                                    <ReactMarkdown>{display(safeString(week.mini_project)) || t("No project specified.")}</ReactMarkdown>
                                </div>
                            </div>
                            {week.success_criteria && (
                                <div style={{ padding: "14px 16px", background: "linear-gradient(135deg, rgba(16,185,129,0.02) 0%, rgba(16,185,129,0.003) 100%)", borderRadius: "var(--radius-lg)", border: "1px solid rgba(16,185,129,0.1)" }}>
                                    <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--accent-emerald)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Award size={12} />
                                        <span>{t("Success Criteria")}</span>
                                    </div>
                                    <div style={{ color: "var(--fg-secondary)", fontSize: "0.85rem", lineHeight: 1.5, fontWeight: 500 }}>
                                        {display(safeString(week.success_criteria))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "0 0 0 32px" }}>
                            {week.youtube_resources && week.youtube_resources.length > 0 && (
                                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(week.topic + " tutorial")}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--accent-rose)", textDecoration: "none", fontWeight: 700, fontSize: "0.75rem", padding: "6px 12px", background: "rgba(239,68,68,0.08)", borderRadius: "100px", border: "1px solid rgba(239,68,68,0.15)" }}>
                                    <YoutubeIcon style={{ fontSize: "12px" }} />
                                    <span>{t("YouTube Tutorial")}</span>
                                </a>
                            )}
                            {week.article_resources?.slice(0, 1).map((url, j) => (
                                <a key={`art-${j}`} href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--brand)", textDecoration: "none", fontWeight: 700, fontSize: "0.75rem", padding: "6px 12px", background: "rgba(59,130,246,0.08)", borderRadius: "100px", border: "1px solid rgba(59,130,246,0.15)" }}>
                                    <FileText size={12} />
                                    <span>{t("Technical Article")}</span>
                                </a>
                            ))}
                            {week.official_docs?.slice(0, 1).map((url, j) => (
                                <a key={`doc-${j}`} href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--accent-emerald)", textDecoration: "none", fontWeight: 700, fontSize: "0.75rem", padding: "6px 12px", background: "rgba(16,185,129,0.08)", borderRadius: "100px", border: "1px solid rgba(16,185,129,0.15)" }}>
                                    <BookOpen size={12} />
                                    <span>{t("Official Docs")}</span>
                                </a>
                            ))}
                            {week.github_resources?.slice(0, 1).map((url, j) => (
                                <a key={`gh-${j}`} href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--fg-secondary)", textDecoration: "none", fontWeight: 700, fontSize: "0.75rem", padding: "6px 12px", background: "var(--bg-surface)", borderRadius: "100px", border: "1px solid var(--border-subtle)" }}>
                                    <GithubIcon style={{ fontSize: "12px" }} />
                                    <span>{t("GitHub Repo")}</span>
                                </a>
                            ))}
                            <a href={`https://www.google.com/search?q=${encodeURIComponent(week.topic + " MCQ quiz practice test online")}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--accent-amber)", textDecoration: "none", fontWeight: 700, fontSize: "0.75rem", padding: "6px 12px", background: "rgba(251,191,36,0.08)", borderRadius: "100px", border: "1px solid rgba(251,191,36,0.15)" }}>
                                <CheckCircle2 size={12} />
                                <span>{t("Practice Test")}</span>
                            </a>
                        </div>

                        {week.explore_more_questions && week.explore_more_questions.length > 0 && (
                            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)", marginLeft: "32px" }}>
                                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--fg-muted)", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <Search size={10} style={{ color: "var(--accent-cyan)" }} />
                                    <span>{t("Private Search Assist — Explore More")}</span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                                    {week.explore_more_questions.map((question, qIdx) => (
                                        <a key={`q-${qIdx}`} href={`https://duckduckgo.com/?q=${encodeURIComponent(question)}`} target="_blank" rel="noreferrer" style={{ display: "block", padding: "10px 12px", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "10px", color: "var(--fg-secondary)", fontSize: "0.75rem", fontWeight: 500, textDecoration: "none", transition: "all 0.2s ease-in-out" }}>
                                            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                                                <HelpCircle size={12} style={{ color: "var(--accent-cyan)", flexShrink: 0, marginTop: "2px" }} />
                                                <span>{display(question)}</span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default RoadmapPanel;
