"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, MessageSquare } from "lucide-react";
import { optimizeLinkedin, getMarketConfig } from "@/services/api";
import LinkedInPanel from "@/components/full-analysis/LinkedInPanel";
import { LinkedInStrategy } from "@/types";
import { toast } from "react-hot-toast";
import { useLanguage } from "@/components/LanguageProvider";

export default function LinkedInPage() {
  const { t, locale } = useLanguage();
  const [config, setConfig] = useState<any>(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [strategy, setStrategy] = useState<LinkedInStrategy | null>(null);

  useEffect(() => {
    getMarketConfig()
      .then((data) => {
        setConfig(data);
        if (data.roles?.length) setRole(data.roles[0]);
      })
      .catch(console.error);
  }, []);

  const handleOptimize = async () => {
    if (!role) return toast.error(t("Please select a target role"));
    setLoading(true);
    setStrategy(null);
    try {
      const data = await optimizeLinkedin(role, undefined, locale);
      setStrategy(data.strategy || data);
      toast.success(t("Strategy generated successfully!"));
      if (typeof window !== "undefined") window.dispatchEvent(new Event("rateLimitUpdated"));
    } catch (err: any) {
      toast.error(err.message || t("Optimization failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-10" style={{ maxWidth: "1000px" }}>
      <div className="mb-8 animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={15} style={{ color: "#0a66c2" }} />
          <span className="text-label" style={{ color: "#0a66c2" }}>{t("LinkedIn")}</span>
        </div>
        <h1 className="text-h1" style={{ color: "var(--fg-primary)" }}>{t("LinkedIn Optimizer")}</h1>
        <p className="mt-2" style={{ color: "var(--fg-secondary)", fontSize: "0.9375rem" }}>
          {t("Build a recruiter-ready brand using AI agents.")}
        </p>
      </div>

      <div className="card mb-10 animate-fade-up-delay-1" style={{ padding: "28px" }}>
        <div className="mb-5">
          <label className="text-label mb-2 block">{t("Target Career Role")}</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input">
            {config?.roles?.map((r: string) => (
              <option key={r} value={r} style={{ background: "var(--bg-surface)" }}>{t(r)}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleOptimize}
          disabled={loading}
          className="btn-glow"
          style={{ padding: "14px", width: "100%", fontSize: "0.9375rem", fontWeight: 600 }}
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {loading ? t("Forging Your Brand...") : t("Generate LinkedIn Strategy")}
        </button>
      </div>

      {loading && (
        <div className="text-center py-16">
          <Loader2 size={40} className="animate-spin mx-auto mb-4" style={{ color: "#0a66c2" }} />
          <h2 className="text-h2" style={{ color: "var(--fg-primary)" }}>{t("Synthesizing Brand Strategy...")}</h2>
        </div>
      )}

      {strategy && (
        <div className="animate-fade-up">
          <LinkedInPanel strategy={strategy} />
        </div>
      )}
    </div>
  );
}
