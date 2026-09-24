import React from "react";
import { History, Trash2, X, Star, Clock } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

interface Props {
    history: any[];
    onSelect: (session: any) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

export default function InterviewHistory({ history, onSelect, onDelete, onClose }: Props) {
    const { t } = useLanguage();
    return (
        <div style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(12px)",
            zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
        }}>
            <div className="card animate-scale-in" style={{
                width: "100%", maxWidth: "520px",
                display: "flex", flexDirection: "column", maxHeight: "80vh", overflow: "hidden"
            }}>
                <div style={{
                    padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                    <div className="flex items-center gap-2">
                        <History size={16} style={{ color: "var(--brand)" }} />
                        <h3 style={{ color: "var(--fg-primary)", fontSize: "1rem", fontWeight: 700 }}>{t("Session History")}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost btn-icon"
                        style={{ color: "var(--fg-muted)" }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div data-lenis-prevent style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                    {history.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--fg-muted)" }}>
                            <History size={28} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                            <p style={{ fontSize: "0.8125rem" }}>{t("No interview sessions yet")}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col" style={{ gap: "8px" }}>
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="card-hover"
                                    style={{
                                        padding: "14px 16px", borderRadius: "var(--radius-lg)",
                                        display: "flex", justifyContent: "space-between", alignItems: "center",
                                        cursor: "pointer"
                                    }}
                                >
                                    <div
                                        onClick={() => onSelect(item)}
                                        style={{ flex: 1, minWidth: 0 }}
                                    >
                                        <div style={{
                                            color: "var(--fg-primary)", fontWeight: 600, fontSize: "0.875rem",
                                            marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                                        }}>
                                            {item.target_role}
                                        </div>
                                        <div className="flex items-center" style={{ gap: "12px", fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} />
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </span>
                                            {item.score != null && (
                                                <span className="flex items-center gap-1" style={{ color: "var(--accent-emerald)" }}>
                                                    <Star size={11} />
                                                    {Math.round(item.score)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                        className="btn btn-ghost btn-icon"
                                        style={{ color: "var(--accent-rose)", flexShrink: 0 }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
