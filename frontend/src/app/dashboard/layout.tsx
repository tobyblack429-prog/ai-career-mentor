"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { api } from "@/services/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    let active = true;
    setSessionError(false);
    void api.post("/auth/anonymous-session").then(() => {
      if (active) setSessionReady(true);
    }).catch(() => {
      if (active) setSessionError(true);
    });
    return () => { active = false; };
  }, [sessionAttempt]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!sessionReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4" style={{ background: "var(--bg-base)", color: "var(--fg-primary)" }}>
        <p>{sessionError ? "访客会话连接失败，请检查网络后重试。" : "正在准备安全访客会话…"}</p>
        {sessionError && (
          <button type="button" onClick={() => setSessionAttempt((attempt) => attempt + 1)} className="rounded-lg px-4 py-2" style={{ background: "var(--brand)", color: "white" }}>
            重试
          </button>
        )}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-base)", color: "var(--fg-primary)" }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className="shrink-0 h-screen sticky top-0" style={{ width: "var(--sidebar-w)" }}>
          <Sidebar />
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0"
            style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)", zIndex: "var(--z-overlay)" }}
          />
          <div
            className="fixed top-0 left-0 h-full"
            style={{
              width: "240px",
              zIndex: "calc(var(--z-overlay) + 1)",
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            }}
          >
            <Sidebar />
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {process.env.NODE_ENV === "production" && (
          <p className="px-4 py-2 text-center" style={{ fontSize: "0.75rem", color: "var(--fg-muted)", background: "var(--bg-elevated)" }}>
            访客数据仅属于当前浏览器；清除浏览器数据后将无法找回历史记录。请勿上传含敏感信息的真实简历。
          </p>
        )}
        {/* Mobile Top Bar */}
        {isMobile && (
          <div
            className="fixed top-0 left-0 right-0 flex items-center justify-between px-4"
            style={{
              height: "48px",
              background: "rgba(0, 0, 0, 0.9)",
              backdropFilter: "blur(16px)",
              borderBottom: "1px solid var(--border-subtle)",
              zIndex: "var(--z-sidebar)",
            }}
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={t(sidebarOpen ? "Close navigation" : "Open navigation")}
              className="flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                color: "var(--fg-secondary)",
                cursor: "pointer",
              }}
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            <span className="font-display font-semibold" style={{ fontSize: "0.8125rem", color: "var(--fg-primary)" }}>
              我的职业规划ai导师
            </span>
            <div style={{ width: "32px" }} />
          </div>
        )}

        <main style={{ paddingTop: isMobile ? "60px" : "0", paddingBottom: isMobile ? "80px" : "0" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
