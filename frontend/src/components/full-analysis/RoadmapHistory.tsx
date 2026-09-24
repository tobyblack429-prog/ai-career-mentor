import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { History, Trash2, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface Props {
    history: any[];
    onSelect: (roadmap: any) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export default function RoadmapHistory({ history, onSelect, onDelete, onClose }: Props) {
    const { t } = useLanguage();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = "unset"; };
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100vh", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div style={{ width: "100%", maxWidth: "600px", background: "var(--bg-card)", borderRadius: "var(--radius-xl)", border: "1px solid var(--border-default)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
                <div style={{ padding: "24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <History size={20} color="var(--accent-purple)" />
                        <h2 className="font-display" style={{ color: "var(--fg-primary)", fontSize: "1.2rem", fontWeight: 700 }}>{t("Roadmap History")}</h2>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ color: "var(--fg-muted)" }}>
                        <X size={24} />
                    </button>
                </div>
                <div data-lenis-prevent style={{ flex: 1, overflowY: "auto", maxHeight: "calc(80vh - 90px)", padding: "16px" }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--fg-muted)" }}>{t("No roadmaps generated yet.")}</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {history.map((item) => (
                                <div key={item.id} className="card-hover" style={{ padding: "16px", borderRadius: "var(--radius-lg)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div onClick={() => onSelect(item)} style={{ cursor: "pointer", flex: 1 }}>
                                        <div style={{ color: "var(--fg-primary)", fontWeight: 600, marginBottom: "4px" }}>{t(item.target_role)}</div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--fg-muted)" }}>{t("Generated on")} {new Date(item.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <button onClick={() => onDelete(item.id)} className="btn btn-ghost btn-icon" style={{ color: "var(--accent-rose)" }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
