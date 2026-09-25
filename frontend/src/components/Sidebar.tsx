"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Map, TrendingUp,
  MessageSquare, BrainCircuit, Settings, Shield,
} from "lucide-react";
import { formatDisplayName } from "@/utils/formatName";
import { checkAdminAccess } from "@/services/api";
import { useLanguage } from "./LanguageProvider";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/full-analysis", icon: BrainCircuit, label: "Full Analysis" },
  { href: "/dashboard/resume", icon: FileText, label: "Resume" },
  { href: "/dashboard/roadmap", icon: Map, label: "Roadmap" },
  { href: "/dashboard/market", icon: TrendingUp, label: "Market" },
  { href: "/dashboard/linkedin", icon: MessageSquare, label: "LinkedIn" },
  { href: "/dashboard/interview", icon: MessageSquare, label: "Interview" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const [userName, setUserName] = useState("Local User");
  const [initials, setInitials] = useState("LU");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const load = () => {
      const storedName = localStorage.getItem("userName") || "";
      const storedEmail = localStorage.getItem("userEmail") || "";
      const n = storedName && storedName !== "Administrator"
        ? storedName
        : storedEmail
          ? formatDisplayName(storedEmail.split("@")[0])
          : "Local User";
      setUserName(n);
      setInitials(n.slice(0, 2).toUpperCase());
      void checkAdminAccess().then(setIsAdmin).catch(() => setIsAdmin(false));
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  return (
    <aside
      className="flex flex-col h-full select-none"
      style={{
        width: "100%",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div className="px-3 pt-4 pb-3">
        <Link href="/" className="flex items-center gap-2.5 no-underline" style={{ padding: "6px 8px" }}>
          <img src="/brand-icon.png" alt="我的职业规划ai导师" className="w-9 h-9 rounded-lg object-contain shrink-0 bg-white" />
          <div className="flex flex-col">
            <span className="font-display font-semibold" style={{ fontSize: "0.8125rem", color: "var(--fg-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              我的职业规划ai导师
            </span>
            <span style={{ fontSize: "0.625rem", color: "var(--fg-muted)", letterSpacing: "0.04em", lineHeight: 1.2 }}>
              {t("AI Career Coach")}
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-1 overflow-y-auto">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="sidebar-nav-link"
              style={{
                background: active ? "var(--brand-glow)" : "transparent",
                color: active ? "var(--brand-light)" : "var(--fg-muted)",
                borderColor: active ? "rgba(59, 130, 246, 0.10)" : "transparent",
                fontWeight: active ? 500 : 400,
                fontSize: "0.8125rem",
              }}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              <span className="flex-1">{t(label)}</span>
              {active && (
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--brand)" }} />
              )}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            href="/dashboard/admin/observability"
            className="sidebar-nav-link"
            style={{
              marginTop: "8px",
              paddingTop: "10px",
              borderTop: "1px solid var(--border-subtle)",
              background: pathname === "/dashboard/admin/observability" ? "var(--brand-glow)" : "transparent",
              color: pathname === "/dashboard/admin/observability" ? "var(--brand-light)" : "var(--fg-muted)",
            }}
          >
            <Shield size={15} strokeWidth={pathname === "/dashboard/admin/observability" ? 2 : 1.5} />
            <span className="flex-1">{t("Admin Console")}</span>
          </Link>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <Link href="/dashboard/settings" className="sidebar-nav-link" style={{
          marginBottom: "6px",
          background: pathname === "/dashboard/settings" ? "var(--brand-glow)" : "transparent",
          color: pathname === "/dashboard/settings" ? "var(--brand-light)" : "var(--fg-muted)",
        }}>
          <Settings size={14} strokeWidth={1.5} />
          <span>{t("Settings")}</span>
        </Link>

        <div
          className="flex items-center gap-2"
          style={{
            padding: "8px 10px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-sm)",
              background: "var(--brand)",
              fontSize: "0.625rem",
              fontWeight: 700,
              color: "white",
            }}
          >
            {userName === "Local User" && locale === "zh" ? "本" : initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate" style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-primary)", lineHeight: 1.2 }}>
              {userName === "Local User" ? t(userName) : <span data-i18n-ignore="true">{userName}</span>}
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--fg-muted)", lineHeight: 1.2 }}>{t("Local workspace")}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
