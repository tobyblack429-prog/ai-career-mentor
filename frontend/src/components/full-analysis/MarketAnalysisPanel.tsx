import React from "react";
import { TrendingUp, DollarSign, Building2, Target, Activity, FileText, ExternalLink, Briefcase, Cpu } from "lucide-react";
import { MarketTrends } from "@/types";
import { useLanguage } from "@/components/LanguageProvider";
import { translateDynamicToChinese } from "@/i18n/translations";
import { CHINA_CITY_LABELS } from "@/data/chinaMarket";

interface Props {
    data: MarketTrends;
    role: string;
}

export default function MarketAnalysisPanel({ data, role }: Props) {
    const { locale, t } = useLanguage();
    const zh = locale === "zh";
    if (!data) return null;

    const containsChinese = (value: string) => /[\u3400-\u9fff]/.test(value);
    const statusTranslations: Record<string, string> = {
        "Live salary data unavailable": "暂无可核验的公开薪酬数据",
        "Data unavailable": "暂无数据",
        "Stable Demand": "需求稳定",
        "Stable demand": "需求稳定",
        "High demand": "需求旺盛",
        "Moderate demand": "需求适中",
        "Market slowdown": "市场需求放缓",
        "Live data unavailable": "暂无可核验的在线数据",
        "Active market — see summary": "市场招聘活跃，详见摘要",
        "Active openings": "有公开招聘信息",
        "Multiple openings available": "有多个公开职位",
    };
    const zhStatus = (value: unknown, fallback: string) => {
        const text = typeof value === "string" ? value.trim() : "";
        if (!zh) return text || fallback;
        if (!text) return fallback;
        if (containsChinese(text)) return text;
        return statusTranslations[text] || fallback;
    };
    const companyNames: Record<string, string> = {
        "Alibaba": "阿里巴巴", "Alibaba Group": "阿里巴巴", "Tencent": "腾讯",
        "ByteDance": "字节跳动", "Baidu": "百度", "Huawei": "华为", "JD.com": "京东",
        "Meituan": "美团", "Xiaomi": "小米", "NetEase": "网易", "Ant Group": "蚂蚁集团",
        "Microsoft": "微软", "Amazon": "亚马逊", "Apple": "苹果", "Google": "谷歌",
    };
    const displayCompany = (value: string, index: number) => {
        if (!zh) return value;
        if (containsChinese(value)) return value;
        return companyNames[value] || `公开来源记录企业 ${index + 1}`;
    };

    const skillsList = data.top_skills_freq || [];
    const companiesList = data.hiring_companies || data.company_hiring_stats || [];
    const hiringVol = zhStatus(data.hiring_volume, zh ? "公开资料未披露职位数量" : "Data unavailable");
    const salaryRange = typeof data.salary_range === "string" ? { formatted: data.salary_range } : (data.salary_range || {});
    const salaryLabel = zhStatus(salaryRange.formatted, zh ? "暂无可核验的公开薪酬数据" : "Data unavailable");
    const hasLiveData = data.is_live !== false;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }} className="animate-fade-up">

            {/* ── Hero Header ─────────────────────────────────────────────── */}
            <div style={{
                position: "relative", overflow: "hidden",
                padding: "36px 40px", borderRadius: "28px",
                background: "linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.6) 100%)",
                backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 30px 60px -12px rgba(0,0,0,0.5)"
            }}>
                {/* Glow accents */}
                <div style={{ position: "absolute", top: "-40%", right: "-5%", width: "350px", height: "350px", background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
                <div style={{ position: "absolute", bottom: "-40%", left: "-5%", width: "280px", height: "280px", background: "radial-gradient(circle, rgba(168,85,247,0.10) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

                {/* Top row: title + badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", position: "relative", zIndex: 2 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                            <Activity size={14} color="#06b6d4" />
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#06b6d4", letterSpacing: "0.04em" }}>{zh ? "中国就业市场分析" : "Live Market Intelligence"}</span>
                        </div>
                        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "1.7rem", fontWeight: 900, margin: 0, letterSpacing: "-0.02em", color: "white" }}>
                            {zh ? t(data.role || role) : (data.role || role)}
                            <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500, fontSize: "1.1rem", marginLeft: "12px" }}>{zh ? `· ${CHINA_CITY_LABELS[data.location] || "中国"}` : `in ${data.location}`}</span>
                        </h2>
                        {data.seniority && (
                            <span style={{ display: "inline-block", marginTop: "8px", padding: "4px 12px", borderRadius: "100px", background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                {zh ? ({ Intern: "实习级", Junior: "初级", Middle: "中级", Mid: "中级", Senior: "高级" }[data.seniority] || "经验级别") : `${data.seniority} Level`}
                            </span>
                        )}
                    </div>
                    <div style={{
                        padding: "8px 20px", borderRadius: "100px",
                        background: hasLiveData ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                        border: `1px solid ${hasLiveData ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
                        display: "flex", alignItems: "center", gap: "8px"
                    }}>
                        <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: hasLiveData ? "#10b981" : "#f59e0b", boxShadow: `0 0 8px ${hasLiveData ? "#10b981" : "#f59e0b"}` }} />
                        <span style={{ color: hasLiveData ? "#10b981" : "#f59e0b", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {zh ? (hasLiveData ? "在线来源已核验" : "备用数据") : (hasLiveData ? "Live Verified" : "Fallback Data")}
                        </span>
                    </div>
                </div>

                {/* Stat cards row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", position: "relative", zIndex: 2 }}>
                    {/* Salary */}
                    <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(16,185,129,0.1)" }}><DollarSign size={15} color="#10b981" /></div>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>{zh ? "公开薪酬信息" : "Average Salary"}</span>
                        </div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "white", lineHeight: 1.3 }}>{salaryLabel}</div>
                    </div>

                    {/* Demand */}
                    <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(6,182,212,0.1)" }}><TrendingUp size={15} color="#06b6d4" /></div>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>{zh ? "需求趋势" : "Demand Trend"}</span>
                        </div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "white" }}>{zhStatus(data.market_trend, zh ? "暂无可核验趋势" : "Stable Demand")}</div>
                    </div>

                    {/* Openings */}
                    <div style={{ padding: "24px", borderRadius: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                            <div style={{ padding: "6px", borderRadius: "8px", background: "rgba(244,63,94,0.1)" }}><Briefcase size={15} color="#f43f5e" /></div>
                            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}>{zh ? "公开招聘数量" : "Live Openings"}</span>
                        </div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "white" }}>{hiringVol}</div>
                    </div>
                </div>
            </div>

            {/* ── Executive Summary ───────────────────────────────────────── */}
            {data.summary && (
                <div style={{
                    padding: "28px 32px", borderRadius: "20px",
                    background: "linear-gradient(90deg, rgba(168,85,247,0.06) 0%, rgba(6,182,212,0.03) 100%)",
                    border: "1px solid rgba(168,85,247,0.15)", borderLeft: "4px solid #a855f7"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                        <FileText size={18} color="#a855f7" />
                        <h4 style={{ color: "white", fontSize: "1rem", fontWeight: 800, margin: 0 }}>{zh ? "就业市场摘要" : "Executive Market Summary"}</h4>
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.78)", fontSize: "0.95rem", lineHeight: "1.75", margin: 0 }}>
                        {zh ? (containsChinese(data.summary) ? data.summary : translateDynamicToChinese(data.summary, "description")) : data.summary}
                    </p>
                </div>
            )}

            {/* ── Skill Matrix ────────────────────────────────────────────── */}
            {skillsList.length > 0 && (
                <div style={{ padding: "32px", borderRadius: "24px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px" }}>
                        <div style={{ padding: "8px", borderRadius: "10px", background: "rgba(251,191,36,0.1)" }}><Target size={18} color="#fbbf24" /></div>
                        <h4 style={{ color: "white", fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>{zh ? "核心技能矩阵" : "Core Skill Matrix"}</h4>
                        <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{zh ? `${skillsList.length} 项技能` : `${skillsList.length} skills`}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {skillsList.map((item: any, i: number) => {
                            const freq = item.frequency || 50;
                            const isHigh = freq >= 75;
                            const isMed = freq >= 45 && freq < 75;
                            const barColor = isHigh ? "#fbbf24" : isMed ? "#06b6d4" : "rgba(255,255,255,0.25)";
                            return (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                    <span style={{ width: "160px", flexShrink: 0, color: isHigh ? "#fcd34d" : isMed ? "#67e8f9" : "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: "0.9rem", textAlign: "right" }}>
                                        {zh ? translateDynamicToChinese(item.skill, "skill") : item.skill}
                                    </span>
                                    <div style={{ flex: 1, height: "10px", borderRadius: "100px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", width: `${freq}%`, borderRadius: "100px",
                                            background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                                            transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                                            boxShadow: isHigh ? `0 0 12px ${barColor}44` : "none"
                                        }} />
                                    </div>
                                    <span style={{ width: "40px", flexShrink: 0, color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 800, textAlign: "right" }}>
                                        {freq}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Companies + Sources row ─────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: companiesList.length > 0 ? "1.2fr 1fr" : "1fr", gap: "24px" }}>

                {/* Companies */}
                {companiesList.length > 0 && (
                    <div style={{ padding: "32px", borderRadius: "24px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                            <div style={{ padding: "8px", borderRadius: "10px", background: "rgba(244,63,94,0.1)" }}><Building2 size={18} color="#f43f5e" /></div>
                            <h4 style={{ color: "white", fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>{zh ? "公开招聘企业" : "Top Hiring Companies"}</h4>
                            <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{zh ? `${companiesList.length} 家` : `${companiesList.length} found`}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {companiesList.map((company: any, i: number) => (
                                <div key={i} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "16px 20px", borderRadius: "14px",
                                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)"
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f43f5e", boxShadow: "0 0 8px rgba(244,63,94,0.4)" }} />
                                        <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 700, fontSize: "0.95rem" }}>{displayCompany(company.name, i)}</span>
                                    </div>
                                    {company.hiring_volume && company.hiring_volume.toUpperCase() !== "UNKNOWN" ? (
                                        <span style={{ padding: "5px 12px", borderRadius: "100px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", color: "#fb7185", fontSize: "0.7rem", fontWeight: 700 }}>
                                            {zhStatus(company.hiring_volume, zh ? "有公开招聘信息" : "Active")}
                                        </span>
                                    ) : (
                                        <span style={{ padding: "5px 12px", borderRadius: "100px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", fontWeight: 700 }}>
                                            {zh ? "招聘中" : "Active"}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Sources */}
                {data.sources && data.sources.length > 0 && (
                    <div style={{ padding: "32px", borderRadius: "24px", background: "rgba(15,23,42,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                            <div style={{ padding: "8px", borderRadius: "10px", background: "rgba(6,182,212,0.1)" }}><ExternalLink size={18} color="#06b6d4" /></div>
                            <h4 style={{ color: "white", fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>{zh ? "在线来源" : "Live Sources"}</h4>
                            <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>{zh ? `${data.sources.length} 个来源` : `${data.sources.length} sources`}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {data.sources.slice(0, 8).map((source, index) => {
                                let hostname = "";
                                try { hostname = new URL(source).hostname.replace("www.", ""); } catch {}
                                return (
                                    <a key={index} href={source} target="_blank" rel="noreferrer" style={{
                                        display: "flex", alignItems: "center", gap: "8px",
                                        padding: "10px 14px", borderRadius: "10px",
                                        background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.1)",
                                        textDecoration: "none", transition: "all 0.15s"
                                    }}>
                                        <ExternalLink size={12} color="#06b6d4" style={{ flexShrink: 0 }} />
                                        <span style={{ color: "#67e8f9", fontSize: "0.8rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {zh ? `查看来源 ${index + 1}` : (hostname || source)}
                                        </span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Provider metadata ───────────────────────────────────────── */}
            {data.provider && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", alignSelf: "flex-start" }}>
                    <Cpu size={13} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>
                        {zh ? `数据处理方式：在线检索 · ${hasLiveData ? "已核验" : "备用结果"}` : `Powered by ${data.provider.toUpperCase()} · ${hasLiveData ? "Live Data" : "Fallback"}`}
                    </span>
                </div>
            )}
        </div>
    );
}
