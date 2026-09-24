"use client";

import React, { useState, useEffect } from "react";
import { History, Sparkles, Trophy, RotateCcw, FileText, X } from "lucide-react";
import { getInterviewHistory, deleteInterview, getInterviewDetails, getUserStats } from "@/services/api";
import InterviewWizard from "@/components/interview/InterviewWizard";
import InterviewInterface from "@/components/interview/InterviewInterface";
import InterviewHistory from "@/components/interview/InterviewHistory";
import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";

export default function InterviewPage() {
  const { t, locale } = useLanguage();
  const displayInterviewText = (value: string) => {
    if (locale !== "zh" || /[\u3400-\u9fff]/.test(value)) return value;
    return "这条历史面试内容没有中文版本，请重新开始面试以生成中文内容。";
  };
  const router = useRouter();
  const [view, setView] = useState<"wizard" | "active" | "result">("wizard");
  const [sessionData, setSessionData] = useState<{ role: string; company: any; type: string; roleLevel: string } | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [checkingResume, setCheckingResume] = useState(false);
  const [finalFeedback, setFinalFeedback] = useState<string>("");

  useEffect(() => {
    getInterviewHistory().then((data) => setHistory(data.history || [])).catch(console.error);
  }, []);

  const handleStart = async (role: string, company: any, type: string, roleLevel: string) => {
    if (type === "technical") {
      setCheckingResume(true);
      try {
        const stats = await getUserStats();
        if (!stats.lastResumeAnalysis) {
          setShowResumeModal(true);
          return;
        }
      } catch (err) {
        console.error("Failed to check resume status", err);
      } finally {
        setCheckingResume(false);
      }
    }
    setSessionData({ role, company, type, roleLevel });
    setView("active");
  };

  const handleEnd = (score: number, feedback: string) => {
    setFinalScore(score);
    setFinalFeedback(feedback);
    setView("result");
    getInterviewHistory().then((data) => setHistory(data.history || []));
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInterview(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch {
      console.error("Delete failed");
    }
  };

  const handleSelectHistory = async (session: any) => {
    try {
      const fullDetails = await getInterviewDetails(session.id);
      setSelectedSession(fullDetails);
      setShowHistory(false);
      setView("result");
      setFinalScore(fullDetails.score);

      let feedback = "";
      if (fullDetails.chat_history) {
        const feedbackMsg = fullDetails.chat_history.find(
          (m: any) => m.type === "feedback" || (m.role === "interviewer" && m.content.includes("That concludes our interview"))
        );
        if (feedbackMsg) {
          feedback = feedbackMsg.content;
        } else {
          const overallMsg = fullDetails.chat_history.find(
            (m: any) => m.role === "interviewer" && m.content.includes("OVERALL SCORE")
          );
          if (overallMsg) feedback = overallMsg.content;
        }
      }
      setFinalFeedback(feedback);
    } catch {
      console.error("Failed to load details");
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10" style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} style={{ color: "var(--brand)" }} />
            <span className="text-label" style={{ color: "var(--brand)" }}>{t("Interview")}</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--fg-primary)", letterSpacing: "-0.02em" }}>
            AI <span className="gradient-text-brand">{t("Interviewer")}</span>
          </h1>
          <p style={{ color: "var(--fg-secondary)", fontSize: "0.875rem", marginTop: "4px" }}>
            {t("Dynamic simulations for 500+ global companies.")}
          </p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="btn btn-secondary btn-sm"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <History size={14} /> {t("History")}
        </button>
      </div>

      {/* Views */}
      {view === "wizard" && <InterviewWizard onStart={handleStart} loading={checkingResume} />}

      {view === "active" && sessionData && (
        <InterviewInterface
          role={sessionData.role}
          company={sessionData.company}
          type={sessionData.type}
          roleLevel={sessionData.roleLevel}
          onEnd={handleEnd}
          onBack={() => { setView("wizard"); setSessionData(null); }}
        />
      )}

      {view === "result" && (
        <div className="animate-fade-up" style={{ maxWidth: "720px", margin: "0 auto" }}>
          <div className="card" style={{ padding: "40px", marginBottom: "20px" }}>
            <div className="text-center" style={{ marginBottom: "32px" }}>
              <div style={{
                width: "64px", height: "64px", borderRadius: "var(--radius-xl)",
                background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px"
              }}>
                <Trophy size={32} style={{ color: "var(--accent-amber)" }} />
              </div>
              <h2 className="font-display" style={{ fontSize: "2.5rem", fontWeight: 800, color: "var(--fg-primary)", marginBottom: "4px", fontVariantNumeric: "tabular-nums" }}>
                {finalScore != null ? `${Math.round(finalScore)}%` : "--"}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--fg-secondary)" }}>
                {selectedSession ? `${t("Reviewing:")} ${t(selectedSession.target_role)}` : t("Interview Simulation Complete")}
              </p>
            </div>

            {/* Evaluation Report */}
            {finalFeedback && (
              <div className="card" style={{ padding: "24px", marginBottom: "24px" }}>
                <h3 className="flex items-center gap-2" style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "16px" }}>
                  <Sparkles size={16} style={{ color: "var(--brand)" }} /> {t("Performance Evaluation")}
                </h3>
                <div style={{ fontSize: "0.8125rem", lineHeight: 1.7, color: "var(--fg-secondary)" }}>
                  <ReactMarkdown
                    components={{
                      h3: ({ ...props }) => (
                        <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--brand)", marginTop: "16px", marginBottom: "6px" }} {...props} />
                      ),
                      strong: ({ ...props }) => (
                        <strong style={{ color: "var(--fg-primary)", fontWeight: 700 }} {...props} />
                      ),
                      ul: ({ ...props }) => (
                        <ul style={{ listStyleType: "disc", paddingLeft: "18px", margin: "8px 0" }} {...props} />
                      ),
                      li: ({ ...props }) => <li style={{ marginBottom: "4px" }} {...props} />,
                    }}
                  >
                    {displayInterviewText(finalFeedback.split(/OVERALL SCORE\s*:/i)[0].trim())}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Transcript */}
            {selectedSession?.chat_history && (
              <div data-lenis-prevent className="card" style={{ padding: "20px", maxHeight: "360px", overflowY: "auto", marginBottom: "24px" }}>
                <h3 className="text-label" style={{ marginBottom: "14px" }}>{t("Interview Transcript")}</h3>
                <div className="flex flex-col" style={{ gap: "14px" }}>
                  {selectedSession.chat_history
                    .filter((m: any) => m.role !== "system")
                    .map((msg: any, i: number) => (
                      <div key={i} style={{ borderLeft: `2px solid ${msg.role === "interviewer" ? "var(--brand)" : "var(--accent-cyan)"}`, paddingLeft: "12px" }}>
                        <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: msg.role === "interviewer" ? "var(--brand)" : "var(--accent-cyan)", marginBottom: "3px" }}>
                          {msg.role === "interviewer" ? t("Interviewer") : t("You")}
                        </div>
                        <div style={{ fontSize: "0.8125rem", color: "var(--fg-secondary)", lineHeight: 1.6 }}>{displayInterviewText(msg.content)}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => { setView("wizard"); setSelectedSession(null); }}
                className="btn btn-primary"
                style={{ padding: "12px 24px", fontWeight: 600 }}
              >
                <RotateCcw size={15} /> {t("Back to Dashboard")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <InterviewHistory
          history={history}
          onSelect={handleSelectHistory}
          onDelete={handleDelete}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Resume Required Modal */}
      {showResumeModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(12px)",
          zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
          <div className="card animate-scale-in" style={{ width: "100%", maxWidth: "400px", padding: "28px", textAlign: "center" }}>
            <div className="flex justify-end" style={{ marginBottom: "12px" }}>
              <button onClick={() => setShowResumeModal(false)} className="btn btn-ghost btn-icon" style={{ color: "var(--fg-muted)" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(244, 63, 94, 0.08)", color: "var(--accent-rose)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px"
            }}>
              <FileText size={24} />
            </div>
            <h3 className="font-display" style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--fg-primary)", marginBottom: "8px" }}>
              {t("Resume Analysis Required")}
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--fg-secondary)", lineHeight: 1.6, marginBottom: "24px" }}>
              {t("Technical interviews require a parsed resume to customize questions. Please upload your resume first.")}
            </p>
            <div className="flex flex-col" style={{ gap: "8px" }}>
              <button
                onClick={() => { setShowResumeModal(false); router.push("/dashboard/resume"); }}
                className="btn btn-primary w-full"
                style={{ padding: "11px", fontWeight: 600 }}
              >
                {t("Go to Resume Upload")}
              </button>
              <button
                onClick={() => setShowResumeModal(false)}
                className="btn btn-secondary w-full"
                style={{ padding: "11px", fontWeight: 600 }}
              >
                {t("Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
