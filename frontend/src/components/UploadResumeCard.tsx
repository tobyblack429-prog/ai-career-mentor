"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle, X, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { analyzeResume, getMarketConfig } from "@/services/api";
import type { ResumeAnalysis } from "@/types";
import { useLanguage } from "./LanguageProvider";
import { translateDynamicToChinese } from "@/i18n/translations";

interface Props {
    onAnalysisComplete?: (analysis: ResumeAnalysis, filename: string) => void;
    provider?: string;
}

type Status = "idle" | "uploading" | "analyzing" | "done" | "error";

export default function UploadResumeCard({ onAnalysisComplete, provider }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [roles, setRoles] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const { t, locale } = useLanguage();

    useEffect(() => {
        getMarketConfig()
            .then((data) => {
                if (data?.roles && data.roles.length > 0) {
                    setRoles(data.roles);
                    setSelectedRole(data.roles[0]);
                }
            })
            .catch((err) => {
                console.error("Failed to load roles from API:", err);
            });
    }, []);

    const onDrop = useCallback((accepted: File[]) => {
        if (accepted.length === 0) return;
        setFile(accepted[0]);
        setStatus("idle");
        setError(null);
        setProgress(0);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/pdf": [".pdf"] },
        maxFiles: 1,
        maxSize: 5 * 1024 * 1024,
    });

    const removeFile = () => {
        setFile(null);
        setStatus("idle");
        setError(null);
        setProgress(0);
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setError(null);
        setStatus("analyzing");
        setProgress(20);

        try {
            const progressInterval = setInterval(() => {
                setProgress((p) => (p < 88 ? p + 4 : p));
            }, 800);

            const result = await analyzeResume(file, selectedRole, provider);

            clearInterval(progressInterval);
            setProgress(100);
            setStatus("done");

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("rateLimitUpdated"));
            }

            onAnalysisComplete?.(result.analysis, result.filename);
        } catch (err: unknown) {
            setStatus("error");
            setProgress(0);
            const msg =
                err instanceof Error
                    ? err.message
                    : t("Failed to analyze resume. Please try again.");
            setError(
                msg.includes("422")
                    ? t("Could not extract text — make sure PDF is not scanned.")
                    : locale === "zh"
                        ? translateDynamicToChinese(msg, "description")
                        : msg,
            );
        }
    };

    const isLoading = status === "uploading" || status === "analyzing";

    return (
        <div className="card" style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header */}
            <div>
                <h3 className="font-display" style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "4px" }}>
                    {t("Upload Your Resume")}
                </h3>
                <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                    {t("PDF only · Max 5MB · AI analysis in ~15 seconds")}
                </p>
            </div>

            {/* Target Role Selector */}
            <div className="flex flex-col" style={{ gap: "6px" }}>
                <label className="text-label">{t("Target Job Role")}</label>
                <select
                    aria-label={t("Target Role Selector")}
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    disabled={isLoading}
                    className="input"
                    style={{ cursor: isLoading ? "not-allowed" : "pointer" }}
                >
                    {roles.length === 0 ? (
                            <option value="">{t("Loading target roles...")}</option>
                    ) : (
                        roles.map((r) => (
                            <option key={r} value={r}>
                                {locale === "zh" ? translateDynamicToChinese(r, "role") : r}
                            </option>
                        ))
                    )}
                </select>
            </div>

            {/* Drop Zone */}
            {!file ? (
                <div
                    {...getRootProps()}
                    id="resume-dropzone"
                    style={{
                        border: `2px dashed ${isDragActive ? "var(--brand)" : "var(--border-default)"}`,
                        borderRadius: "var(--radius-lg)",
                        padding: "40px 20px",
                        textAlign: "center",
                        cursor: "pointer",
                        background: isDragActive ? "var(--brand-glow)" : "var(--bg-surface)",
                        transition: "all 0.2s"
                    }}
                >
                    <input {...getInputProps()} />
                    <Upload
                        size={32}
                        style={{ margin: "0 auto 10px", color: isDragActive ? "var(--brand)" : "var(--fg-muted)" }}
                    />
                    <p style={{ color: "var(--fg-secondary)", fontSize: "0.8125rem", marginBottom: "4px" }}>
                        {isDragActive ? (
                        <span style={{ color: "var(--brand)", fontWeight: 600 }}>{t("Drop it here!")}</span>
                        ) : (
                            <>
                                <span style={{ color: "var(--fg-primary)", fontWeight: 500 }}>{t("Click to upload")}</span>{" "}
                                {t("or drag & drop")}
                            </>
                        )}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>{t("PDF files only")}</p>
                </div>
            ) : (
                <div
                    style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "14px", borderRadius: "var(--radius-lg)",
                        background: "var(--brand-glow)", border: "1px solid rgba(59, 130, 246, 0.15)"
                    }}
                >
                    <FileText size={20} style={{ color: "var(--brand)", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                            color: "var(--fg-primary)", fontSize: "0.8125rem", fontWeight: 500,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>
                            {locale === "zh" ? t("Selected resume file") : file.name}
                        </p>
                        <p style={{ color: "var(--fg-muted)", fontSize: "0.75rem" }}>
                            {(file.size / 1024).toFixed(1)} {t("KB")}
                        </p>
                    </div>
                    {status === "done" ? (
                        <CheckCircle size={18} style={{ color: "var(--accent-emerald)" }} />
                    ) : (
                        !isLoading && (
                            <button
                                onClick={removeFile}
                                id="resume-remove-btn"
                                className="btn btn-ghost btn-icon"
                                style={{ color: "var(--fg-muted)" }}
                            >
                                <X size={16} />
                            </button>
                        )
                    )}
                </div>
            )}

            {/* Progress Bar & Loading State */}
            {isLoading && (
                <div
                    className="animate-pulse-glow"
                    style={{
                        display: "flex", flexDirection: "column", gap: "20px",
                        padding: "32px", background: "var(--bg-surface)",
                        borderRadius: "var(--radius-xl)", border: "1px dashed rgba(59, 130, 246, 0.15)"
                    }}
                >
                    <div style={{ textAlign: "center" }}>
                        <Loader2 size={36} className="animate-spin" style={{ margin: "0 auto 12px", color: "var(--brand)" }} />
                        <h4 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "6px" }}>
                            {t("AI Agent is Analyzing...")}
                        </h4>
                        <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)" }}>
                            {t("Extracting skills, gaps & strengths from your resume.")}
                        </p>
                    </div>

                    <div className="flex flex-col" style={{ gap: "6px" }}>
                        <div className="flex items-center justify-between">
                            <span style={{ fontSize: "0.7rem", color: "var(--fg-muted)", fontWeight: 600 }}>{t("ANALYSIS PROGRESS")}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--brand)", fontWeight: 700 }}>{progress}%</span>
                        </div>
                        <div style={{ height: "5px", borderRadius: "99px", background: "var(--border-subtle)", overflow: "hidden" }}>
                            <div
                                style={{
                                    height: "100%", width: `${progress}%`,
                                    background: "var(--brand-gradient)", borderRadius: "99px",
                                    transition: "width 0.6s ease"
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Analyze Button */}
            {file && status !== "done" && !isLoading && (
                <button
                    id="resume-analyze-btn"
                    className="btn-glow"
                    onClick={handleAnalyze}
                    style={{ padding: "14px", width: "100%", fontWeight: 600 }}
                >
                    <span className="flex items-center justify-center gap-2">
                        <Sparkles size={16} /> {t("Analyze My Resume")}
                    </span>
                </button>
            )}

            {/* Success Banner */}
            {status === "done" && (
                <div className="badge-green" style={{
                    padding: "10px 14px", borderRadius: "var(--radius-md)", width: "100%",
                    justifyContent: "center", fontSize: "0.8125rem"
                }}>
                    <CheckCircle size={14} />
                    {t("Resume analyzed! Scroll down to see your results.")}
                </div>
            )}

            {/* Error Banner */}
            {status === "error" && error && (
                <div className="badge-rose" style={{
                    padding: "10px 14px", borderRadius: "var(--radius-md)", width: "100%",
                    justifyContent: "flex-start", fontSize: "0.8125rem"
                }}>
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
