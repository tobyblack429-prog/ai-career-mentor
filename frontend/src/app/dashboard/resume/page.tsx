"use client";

import { useState, useEffect } from "react";
import { FileText, Zap, Play } from "lucide-react";
import UploadResumeCard from "@/components/UploadResumeCard";
import ResumeAnalysisPanel from "@/components/ResumeAnalysisPanel";
import { ResumeAnalysis } from "@/types";
import { getUserStats } from "@/services/api";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

export default function ResumePage() {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [analyzedFilename, setAnalyzedFilename] = useState<string>("");
  const [resumeProvider, setResumeProvider] = useState<string>("groq");
  const { t } = useLanguage();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const pref = localStorage.getItem("preferred_provider");
      if (pref) setResumeProvider(pref);
    }

    // Restore the latest locally saved analysis so a demo or previous upload
    // remains visible after navigating away or restarting the frontend.
    getUserStats()
      .then((stats) => {
        if (stats?.lastResumeAnalysis) {
          setAnalysis(stats.lastResumeAnalysis as ResumeAnalysis);
          setAnalyzedFilename(stats.lastResumeFilename || "Saved resume");
        }
      })
      .catch(() => {
        // The upload flow remains available if the stats request is unavailable.
      });
  }, []);

  const handleAnalysisComplete = (result: ResumeAnalysis, filename: string) => {
    setAnalysis(result);
    setAnalyzedFilename(filename);
    setTimeout(() => {
      document.getElementById("analysis-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  };

  return (
    <div className="p-6 md:p-8 lg:p-10" style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={15} style={{ color: "var(--brand)" }} />
          <span className="text-label-brand">{t("Resume")}</span>
        </div>
        <h1 className="text-h1" style={{ color: "var(--fg-primary)" }}>
          {t("Resume Analyzer")}
        </h1>
        <p className="mt-2" style={{ color: "var(--fg-secondary)", fontSize: "0.9375rem", maxWidth: "600px" }}>
          {t("Let our AI agent scan your resume and identify strengths, skills, and areas for improvement.")}
        </p>
      </div>

      {/* Upload Card */}
      <div className="mb-10 animate-fade-up-delay-1" style={{ maxWidth: "800px" }}>
        <UploadResumeCard onAnalysisComplete={handleAnalysisComplete} provider={resumeProvider} />
      </div>

      {/* Analysis Panel */}
      {analysis && (
        <div id="analysis-panel" className="animate-fade-up">
          {/* Practice CTA Banner */}
          <div
            className="card mb-8"
            style={{
              padding: "24px 32px",
              background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)",
              border: "1px solid rgba(139, 92, 246, 0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div>
              <h3
                className="font-display font-bold mb-1"
                style={{ fontSize: "1.125rem", color: "var(--fg-primary)" }}
              >
                {t("Practice your skills through our interview agent")}
              </h3>
              <p style={{ color: "var(--fg-secondary)", fontSize: "0.875rem" }}>
                {t("Your resume is analyzed! Start a tailored mock interview simulation now.")}
              </p>
            </div>
            <button
              onClick={() => router.push("/dashboard/interview")}
              className="btn btn-primary"
              style={{ padding: "12px 24px", fontWeight: 600 }}
            >
              <Play size={14} fill="white" /> {t("Start Interview")}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, var(--border-default))" }} />
            <span className="text-label-brand flex items-center gap-2">
              <Zap size={12} />
              {t("Resume Analysis Detailed Breakdown")}
            </span>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, var(--border-default))" }} />
          </div>

          <ResumeAnalysisPanel analysis={analysis} filename={analyzedFilename} />
        </div>
      )}
    </div>
  );
}
