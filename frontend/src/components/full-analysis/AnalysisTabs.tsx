import React from "react";
import { Briefcase, TrendingUp, Zap } from "lucide-react";

interface Props {
    activeTab: string;
    setActiveTab: (tab: any) => void;
}

export default function AnalysisTabs({ activeTab, setActiveTab }: Props) {
    const tabs = [
        { key: "resume", label: "Resume", icon: Briefcase, color: "#a855f7" },
        { key: "market", label: "Market", icon: TrendingUp, color: "#06b6d4" },
        { key: "roadmap", label: "Roadmap", icon: Zap, color: "#3b82f6" },
        { key: "linkedin", label: "LinkedIn", icon: Briefcase, color: "#0a66c2" },
    ];

    return (
        <div className="analysis-tabs" style={{
            display: "flex", gap: "12px", marginBottom: "32px",
            borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "12px",
        }}>
            {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        className="analysis-tab"
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            background: isActive ? `${tab.color}15` : "transparent",
                            border: isActive ? `1px solid ${tab.color}40` : "1px solid transparent",
                            fontWeight: isActive ? 700 : 500,
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "8px",
                            color: isActive ? tab.color : "rgba(255,255,255,0.4)",
                            padding: "8px 16px",
                            borderRadius: "12px",
                            transition: "all 0.2s",
                        }}
                    >
                        <Icon size={18} />
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
