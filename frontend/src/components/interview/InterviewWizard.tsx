import React, { useState, useEffect, useRef } from "react";
import { Target, Building2, Zap, Sparkles, Loader2, Play, Search, ChevronDown, ChevronUp, X } from "lucide-react";
import { getMarketConfig } from "@/services/api";
import { useLanguage } from "@/components/LanguageProvider";

interface Props {
    onStart: (role: string, company: any, type: string, roleLevel: string) => void;
    loading: boolean;
}

const ROLE_LEVELS = [
    { id: "intern", label: "Intern", desc: "0 yrs — fundamentals & learning potential" },
    { id: "fresher", label: "Fresher", desc: "0–2 yrs — basic problem-solving & projects" },
    { id: "mid", label: "Mid-Level", desc: "3–7 yrs — system design & trade-offs" },
    { id: "senior", label: "Senior", desc: "8+ yrs — architecture, leadership & scale" },
] as const;

export default function InterviewWizard({ onStart, loading }: Props) {
    const { t, locale } = useLanguage();
    const [config, setConfig] = useState<any>(null);
    const [role, setRole] = useState("");
    const [company, setCompany] = useState<any>(null);
    const [type, setType] = useState("technical");
    const [roleLevel, setRoleLevel] = useState<string>("fresher");
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const companyNamesZh: Record<string, string> = {
        Google: "谷歌", Microsoft: "微软", Amazon: "亚马逊", Apple: "苹果", Adobe: "奥多比",
        Oracle: "甲骨文", Salesforce: "赛富时", SAP: "思爱普", Meta: "元宇宙平台公司",
        Netflix: "奈飞", Uber: "优步", Airbnb: "爱彼迎", OpenAI: "OpenAI", Anthropic: "人工智能研究公司",
        NVIDIA: "英伟达", Intel: "英特尔", Qualcomm: "高通", Samsung: "三星", IBM: "国际商业机器公司",
        Cisco: "思科", Nokia: "诺基亚", Ericsson: "爱立信", PayPal: "贝宝", JPMorgan: "摩根大通",
        "Goldman Sachs": "高盛", Deloitte: "德勤", Accenture: "埃森哲", PwC: "普华永道",
        Bosch: "博世", "Robert Bosch": "博世", "Dell Technologies": "戴尔科技", FedEx: "联邦快递",
    };
    const companyLabel = (name: string, index?: number) => {
        if (locale !== "zh") return name;
        return companyNamesZh[name] || `其他面试企业${typeof index === "number" ? ` ${index + 1}` : ""}`;
    };

    useEffect(() => {
        getMarketConfig().then(data => {
            setConfig(data);
            if (data.roles?.length) setRole(data.roles[0]);
            if (data.companies?.length) setCompany(data.companies[0]);
        });
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (!config) return <div className="flex items-center justify-center" style={{ padding: "60px" }}><Loader2 className="animate-spin" size={24} style={{ color: "var(--brand)" }} /></div>;

    const getTierLabel = (tier: string) => {
        const labels: Record<string, string> = {
            "FAANG": t("FAANG & Global Big Tech"),
            "top-indian-product": t("Indian Product Leaders"),
            "indian-service": t("Indian Service Sector"),
            "fintech": t("Fintech & Banking"),
            "mid-product": t("Growth Stage Products"),
            "hardware": t("Hardware & Semiconductors"),
            "gaming": t("Gaming & Metaverses"),
            "security": t("Cybersecurity & Infra"),
            "hft": t("High Frequency Trading (HFT)"),
            "other": t("Specialized & Others")
        };
        return labels[tier] || tier.toUpperCase();
    };

    const filteredCompanies = searchQuery.trim() === ""
        ? config.companies
        : config.companies.filter((c: any) => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const groupedFilteredCompanies = filteredCompanies.reduce((acc: any, c: any) => {
        if (!acc[c.tier]) acc[c.tier] = [];
        acc[c.tier].push(c);
        return acc;
    }, {});

    return (
        <div className="animate-fade-up" style={{ maxWidth: "560px", margin: "0 auto" }}>
            <div className="card" style={{ padding: "40px" }}>
                <div className="text-center" style={{ marginBottom: "36px" }}>
                    <div className="flex items-center justify-center gap-2" style={{ marginBottom: "12px" }}>
                        <div style={{
                            width: "36px", height: "36px", borderRadius: "10px",
                            background: "var(--brand-glow)", display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                            <Sparkles size={18} style={{ color: "var(--brand)" }} />
                        </div>
                    </div>
                    <h2 className="font-display" style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--fg-primary)", marginBottom: "6px" }}>
                        {t("Launch Mock Interview")}
                    </h2>
                    <p style={{ fontSize: "0.8125rem", color: "var(--fg-muted)" }}>
                        {t("Configure your AI-powered simulation")}
                    </p>
                </div>

                <div className="flex flex-col" style={{ gap: "24px" }}>
                    {/* Role */}
                    <div>
                        <label className="text-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                            <Target size={13} style={{ color: "var(--brand)" }} /> {t("Target Role")}
                        </label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="input"
                            style={{ padding: "12px 14px", fontSize: "0.875rem", cursor: "pointer" }}
                        >
                            {config.roles.map((r: string) => <option key={r} value={r}>{t(r)}</option>)}
                        </select>
                    </div>

                    {/* Company */}
                    <div style={{ position: "relative" }} ref={dropdownRef}>
                        <label className="text-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                            <Building2 size={13} style={{ color: "var(--accent-cyan)" }} /> {t("Target Company")}
                        </label>
                        <div
                            onClick={() => setIsOpen(!isOpen)}
                            className="input"
                            style={{
                                padding: "12px 14px", cursor: "pointer", display: "flex",
                                justifyContent: "space-between", alignItems: "center", userSelect: "none"
                            }}
                        >
                            <span style={{ color: company ? "var(--fg-primary)" : "var(--fg-muted)", fontSize: "0.875rem" }}>
                                {company ? companyLabel(company.name) : t("Select a company...")}
                            </span>
                            {isOpen ? <ChevronUp size={15} style={{ color: "var(--fg-muted)" }} /> : <ChevronDown size={15} style={{ color: "var(--fg-muted)" }} />}
                        </div>

                        {isOpen && (
                            <div
                                data-lenis-prevent
                                onWheel={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                                className="glass"
                                style={{
                                    position: "absolute", top: "calc(100% + 6px)", left: 0, width: "100%",
                                    zIndex: 100, maxHeight: "300px", display: "flex", flexDirection: "column",
                                    overflow: "hidden", boxShadow: "var(--shadow-elevated)"
                                }}
                            >
                                <div style={{
                                    padding: "10px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0
                                }}>
                                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                                        <Search size={14} style={{ position: "absolute", left: "12px", color: "var(--fg-muted)" }} />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder={t("Search company...")}
                                            className="input"
                                            style={{ paddingLeft: "34px", fontSize: "0.8125rem" }}
                                            autoFocus
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery("")}
                                                style={{
                                                    position: "absolute", right: "10px", background: "none", border: "none",
                                                    color: "var(--fg-muted)", cursor: "pointer", display: "flex", alignItems: "center"
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ padding: "4px 0", overflowY: "auto", flex: 1 }}>
                                    {filteredCompanies.length === 0 ? (
                                        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-muted)", fontSize: "0.8125rem" }}>
                                            {t("Company not found")}
                                        </div>
                                    ) : (
                                        Object.keys(groupedFilteredCompanies).map(tier => (
                                            <div key={tier}>
                                                <div style={{
                                                    padding: "6px 14px", fontSize: "0.65rem", fontWeight: 700,
                                                    color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.06em"
                                                }}>
                                                    {getTierLabel(tier)}
                                                </div>
                                                {groupedFilteredCompanies[tier].map((c: any, companyIndex: number) => (
                                                    <div
                                                        key={c.name}
                                                        onClick={() => {
                                                            setCompany(c);
                                                            setIsOpen(false);
                                                            setSearchQuery("");
                                                        }}
                                                        style={{
                                                            padding: "9px 14px", fontSize: "0.8125rem", cursor: "pointer",
                                                            color: company?.name === c.name ? "var(--brand-light)" : "var(--fg-secondary)",
                                                            background: company?.name === c.name ? "var(--brand-glow)" : "transparent",
                                                            transition: "background 0.15s"
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (company?.name !== c.name) e.currentTarget.style.background = "var(--bg-hover)";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (company?.name !== c.name) e.currentTarget.style.background = "transparent";
                                                        }}
                                                    >
                                                        {companyLabel(c.name, companyIndex)}
                                                    </div>
                                                ))}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Role Level */}
                    <div>
                        <label className="text-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                            <Target size={13} style={{ color: "var(--accent-purple)" }} /> {t("Your Experience Level")}
                        </label>
                        <div className="grid grid-cols-2" style={{ gap: "10px" }}>
                            {ROLE_LEVELS.map(level => (
                                <button
                                    key={level.id}
                                    onClick={() => setRoleLevel(level.id)}
                                    className={roleLevel === level.id ? "btn-glow" : "btn-secondary"}
                                    style={{
                                        padding: "12px", borderRadius: "var(--radius-lg)", fontWeight: 600,
                                        fontSize: "0.8125rem", textAlign: "left",
                                        ...(roleLevel !== level.id ? { background: "var(--bg-surface)" } : {})
                                    }}
                                >
                                    <div style={{ fontWeight: 700, marginBottom: "2px" }}>{t(level.label)}</div>
                                    <div style={{ fontSize: "0.6875rem", opacity: 0.7, fontWeight: 400 }}>{t(level.desc)}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Type */}
                    <div>
                        <label className="text-label" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                            <Zap size={13} /> {t("Interview Focus")}
                        </label>
                        <div className="grid grid-cols-2" style={{ gap: "10px" }}>
                            {["technical", "behavioral"].map(interviewType => (
                                <button
                                    key={interviewType}
                                    onClick={() => setType(interviewType)}
                                    className={type === interviewType ? "btn-glow" : "btn-secondary"}
                                    style={{
                                        padding: "12px", borderRadius: "var(--radius-lg)", fontWeight: 600,
                                        fontSize: "0.8125rem", textTransform: "capitalize",
                                        ...(type !== interviewType ? { background: "var(--bg-surface)" } : {})
                                    }}
                                >
                                    {t(interviewType)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => onStart(role, company, type, roleLevel)}
                        disabled={loading}
                        className="btn-glow"
                        style={{
                            marginTop: "8px", padding: "16px", borderRadius: "var(--radius-lg)",
                            width: "100%", fontSize: "0.9375rem", fontWeight: 700
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                            {loading ? t("Initializing Agent...") : t("Launch Simulation")}
                    </button>
                </div>
            </div>
        </div>
    );
}
