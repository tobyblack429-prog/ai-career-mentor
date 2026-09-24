import React, { useEffect, useRef } from "react";
import { CheckCircle2, Loader2, Briefcase, TrendingUp, Zap } from "lucide-react";

interface Props {
    logs: string[];
    errors: string[];
    status: "idle" | "loading" | "done" | "error";
}

export default function ProcessLogs({ logs, status }: Props) {
    const consoleRef = useRef<HTMLDivElement>(null);

    // Determine which stages are complete based on log patterns
    const stages = [
        { id: "resume", label: "Resume Context Analysis", icon: Briefcase, pattern: "Resume Node Complete" },
        { id: "market", label: "Market Research & Trends", icon: TrendingUp, pattern: "Market Node Complete" },
        { id: "linkedin", label: "LinkedIn Strategy Forge", icon: Briefcase, pattern: "LinkedIn Node Complete" },
        { id: "roadmap", label: "Curriculum Synthesis", icon: Zap, pattern: "Analysis Complete" },
    ];

    const getStageStatus = (index: number) => {
        if (status === "done") return "done";
        
        const stage = stages[index];
        const isDone = logs.some(log => log.includes(stage.pattern));
        if (isDone) return "done";
        
        if (status === "loading") {
            if (index === 0 || index === 1) {
                // resume and market start immediately at the beginning
                return "running";
            }
            if (index === 2 || index === 3) {
                // linkedin and roadmap only run when both resume and market are done
                const resumeDone = logs.some(log => log.includes("Resume Node Complete"));
                const marketDone = logs.some(log => log.includes("Market Node Complete"));
                if (resumeDone && marketDone) {
                    return "running";
                }
            }
        }
        return "pending";
    };

    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div style={{ maxWidth: "800px", margin: "0 auto" }} className="animate-fade-up">
            {/* Visual Timeline */}
            <div className="analysis-process-steps" style={{
                display: "grid", 
                gridTemplateColumns: "repeat(4, 1fr)", 
                gap: "12px", 
                marginBottom: "32px" 
            }}>
                {stages.map((stage, i) => {
                    const s = getStageStatus(i);
                    const Icon = stage.icon;
                    return (
                        <div key={stage.id} style={{
                            padding: "16px", borderRadius: "16px",
                            background: s === "done" ? "rgba(16,185,129,0.05)" : s === "running" ? "rgba(139,92,246,0.05)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${s === "done" ? "rgba(16,185,129,0.2)" : s === "running" ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)"}`,
                            textAlign: "center", position: "relative", transition: "all 0.3s ease"
                        }}>
                            <div style={{
                                width: "32px", height: "32px", borderRadius: "8px", margin: "0 auto 12px",
                                background: s === "done" ? "#10b981" : s === "running" ? "#a855f7" : "rgba(255,255,255,0.1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: s === "running" ? "0 0 15px rgba(168,85,247,0.4)" : "none"
                            }}>
                                {s === "done" ? <CheckCircle2 size={18} color="white" /> : s === "running" ? <Loader2 size={18} color="white" className="animate-spin" /> : <Icon size={18} color="rgba(255,255,255,0.3)" />}
                            </div>
                            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: s === "pending" ? "rgba(255,255,255,0.3)" : "white", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                                {stage.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Terminal Console Logs */}
            {logs && logs.length > 0 && (
                <div 
                    ref={consoleRef}
                    style={{ 
                        marginTop: "24px", 
                        padding: "20px", 
                        borderRadius: "16px", 
                        background: "rgba(15, 23, 42, 0.6)", 
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        fontFamily: "'Fira Code', monospace",
                        fontSize: "0.82rem",
                        color: "rgba(255, 255, 255, 0.7)",
                        maxHeight: "220px",
                        overflowY: "auto",
                        boxShadow: "inset 0 2px 8px rgba(0,0,0,0.8)",
                        textAlign: "left"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px", marginBottom: "12px", fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#eab308" }} />
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e" }} />
                        <span style={{ marginLeft: "6px", fontWeight: 600, letterSpacing: "0.05em" }}>ORCHESTRATION EVENT STREAM</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {logs.map((log, index) => {
                            const isError = log.includes("!!") || log.includes("failed") || log.includes("Error");
                            const isComplete = log.includes("Complete") || log.includes("Complete");
                            return (
                                <div key={index} style={{ 
                                    display: "flex", 
                                    gap: "8px", 
                                    alignItems: "flex-start",
                                    color: isError ? "#f87171" : isComplete ? "#34d399" : "rgba(255,255,255,0.7)"
                                }}>
                                    <span style={{ color: "#a855f7", userSelect: "none" }}>&gt;</span>
                                    <span>{log}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
