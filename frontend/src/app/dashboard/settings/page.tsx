"use client";

import React, { useState, useEffect } from "react";
import {
  User, Save, MessageSquare as Bell, TrendingUp as CreditCard,
  LayoutDashboard as Monitor, Sparkles as Moon, Zap as Sun, Zap,
  CheckCircle, Settings, Briefcase, Mail
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDisplayName } from "@/utils/formatName";
import { useLanguage } from "@/components/LanguageProvider";

export default function SettingsPage() {
  const { locale, t } = useLanguage();
  const [name, setName] = useState("Local User");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [theme, setTheme] = useState("dark");
  const [notifMarket, setNotifMarket] = useState(true);
  const [notifInterview, setNotifInterview] = useState(true);
  const [notifProduct, setNotifProduct] = useState(false);

  useEffect(() => {
    const storedName = localStorage.getItem("userName") || "";
    const storedEmail = localStorage.getItem("userEmail") || "";
    const displayName = storedName && storedName !== "Administrator"
      ? storedName
      : storedEmail
        ? formatDisplayName(storedEmail.split("@")[0])
        : "Local User";
    setName(displayName === "Local User" ? t("Local User") : displayName);
  }, [locale, t]);

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("userName", name);
      toast.success("Settings saved successfully!");
      setLoading(false);
      window.dispatchEvent(new Event("storage"));
    }, 600);
  };

  const TABS = [
    { id: "profile", label: "My Profile", icon: User, color: "#6366f1" },
    { id: "preferences", label: "Preferences", icon: Settings, color: "#8b5cf6" },
    { id: "notifications", label: "Notifications", icon: Bell, color: "#6366f1" },
    { id: "billing", label: "Billing & Plan", icon: CreditCard, color: "#8b5cf6" },
  ];

  const ToggleSwitch = ({ checked, onChange, label, description }: any) => (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        marginBottom: "12px",
      }}
    >
      <div className="flex-1 mr-4">
        <p className="font-semibold" style={{ fontSize: "0.875rem", color: "var(--fg-primary)" }}>{label}</p>
        <p style={{ fontSize: "0.8125rem", color: "var(--fg-muted)", marginTop: "2px" }}>{description}</p>
      </div>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: "40px", height: "22px", borderRadius: "99px",
          background: checked ? "#6366f1" : "var(--border-default)",
          position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          width: "18px", height: "18px", borderRadius: "50%", background: "white",
          position: "absolute", top: "2px", left: checked ? "20px" : "2px",
          transition: "left 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
        }} />
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 lg:p-10" style={{ maxWidth: "1200px" }}>
      {/* Header */}
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={15} style={{ color: "var(--brand)" }} />
          <span className="text-label-brand">Settings</span>
        </div>
        <h1 className="text-h1" style={{ color: "var(--fg-primary)" }}>Settings & Preferences</h1>
        <p className="mt-2" style={{ color: "var(--fg-secondary)", fontSize: "0.9375rem" }}>
          Manage this local workspace, interface preferences, and usage options.
        </p>
      </div>

      <div className="flex gap-6 animate-fade-up-delay-1 items-start flex-col lg:flex-row">
        {/* Sidebar Tabs */}
        <div className="flex flex-col gap-1 w-full lg:w-56 shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="sidebar-nav-link"
                style={{
                  background: isActive ? `${tab.color}10` : "transparent",
                  color: isActive ? tab.color : "var(--fg-muted)",
                  borderColor: isActive ? `${tab.color}20` : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  justifyContent: "flex-start",
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="card flex-1 w-full" style={{ padding: "32px" }}>

          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="animate-fade-up">
              <h2 className="text-h3 mb-6" style={{ color: "var(--fg-primary)" }}>My Profile</h2>

              <div className="flex items-center gap-6 mb-8">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: "72px", height: "72px", borderRadius: "50%",
                    background: "var(--brand-gradient)", fontSize: "1.5rem", fontWeight: 700, color: "white",
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.25)",
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <button className="btn btn-secondary btn-sm">Upload Avatar</button>
                  <p className="mt-2" style={{ fontSize: "0.6875rem", color: "var(--fg-muted)" }}>JPG or PNG. Max size 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="text-label mb-2 block">Display Name</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-muted)" }} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input input-with-icon"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-label mb-2 block">Workspace Mode</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-muted)" }} />
                    <input
                      type="email"
                      value={t("Local guest workspace")}
                      disabled
                      className="input input-with-icon"
                      style={{ opacity: 0.5, cursor: "not-allowed" }}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <label className="text-label mb-2 block">Professional Headline</label>
                <div className="relative">
                  <Briefcase size={16} className="absolute left-3 top-3" style={{ color: "var(--fg-muted)" }} />
                  <textarea
                    placeholder="e.g. Senior Software Engineer at Tech Corp"
                    rows={3}
                    className="input"
                    style={{ paddingLeft: "38px", resize: "none", fontFamily: "inherit" }}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} disabled={loading} className="btn btn-primary" style={{ padding: "12px 24px" }}>
                  <Save size={16} /> {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === "preferences" && (
            <div className="animate-fade-up">
              <h2 className="text-h3 mb-6" style={{ color: "var(--fg-primary)" }}>Preferences</h2>

              <div className="mb-8">
                <h3 className="flex items-center gap-2 font-semibold mb-4" style={{ fontSize: "0.9375rem", color: "var(--fg-primary)" }}>
                  <Monitor size={16} style={{ color: "var(--accent-cyan)" }} /> Interface Theme
                </h3>
                <div className="flex gap-3">
                  {[
                    { id: "light", icon: Sun, label: "Light" },
                    { id: "dark", icon: Moon, label: "Dark" },
                    { id: "system", icon: Monitor, label: "System" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className="flex flex-col items-center gap-2"
                      style={{
                        padding: "16px",
                        borderRadius: "var(--radius-lg)",
                        border: theme === t.id ? "2px solid var(--brand)" : "1px solid var(--border-default)",
                        background: theme === t.id ? "rgba(59, 130, 246, 0.08)" : "var(--bg-surface)",
                        color: "var(--fg-primary)",
                        fontWeight: 600,
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        width: "100px",
                      }}
                    >
                      <t.icon size={20} style={{ color: theme === t.id ? "var(--brand)" : "var(--fg-muted)" }} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={handleSave} disabled={loading} className="btn btn-primary" style={{ padding: "12px 24px" }}>
                  <Save size={16} /> Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <div className="animate-fade-up">
              <h2 className="text-h3 mb-2" style={{ color: "var(--fg-primary)" }}>Notifications</h2>
              <p className="mb-6" style={{ color: "var(--fg-secondary)", fontSize: "0.875rem" }}>
                Choose how and when you want to be contacted by our AI agents.
              </p>
              <ToggleSwitch checked={notifMarket} onChange={setNotifMarket} label="Market Trend Alerts" description="Get notified weekly about salary and hiring trends in your target role." />
              <ToggleSwitch checked={notifInterview} onChange={setNotifInterview} label="Interview Reminders" description="Reminders to practice mock interviews based on your roadmap." />
              <ToggleSwitch checked={notifProduct} onChange={setNotifProduct} label="Product Updates" description="Be the first to know about new features and AI capabilities." />
            </div>
          )}

          {/* BILLING TAB */}
          {activeTab === "billing" && (
            <div className="animate-fade-up">
              <h2 className="text-h3 mb-6" style={{ color: "var(--fg-primary)" }}>Billing & Plan</h2>

              <div
                className="mb-6"
                style={{
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.15)",
                  borderRadius: "var(--radius-xl)",
                  padding: "28px",
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="badge badge-brand mb-3">
                      <CheckCircle size={12} /> Current Plan
                    </div>
                    <h3 className="font-display font-bold mb-1" style={{ fontSize: "1.25rem", color: "var(--fg-primary)" }}>
                      AI-Powered Career Intelligence
                    </h3>
                    <p style={{ color: "var(--fg-secondary)", fontSize: "0.875rem" }}>You are currently on the Free Tier.</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold" style={{ fontSize: "2rem", color: "var(--fg-primary)", lineHeight: 1 }}>
                      $0<span style={{ fontSize: "0.875rem", color: "var(--fg-muted)", fontWeight: 500 }}>/mo</span>
                    </p>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary w-full" style={{ padding: "14px", fontSize: "0.9375rem", fontWeight: 600 }}>
                <Zap size={18} /> Upgrade to Pro
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
