"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
