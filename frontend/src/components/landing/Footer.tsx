import React from "react";
import Link from "next/link";

export default function Footer() {
  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-base)" }}>
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Logo + System Status */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <img src="/brand-icon.png" alt="我的职业规划ai导师" className="w-7 h-7 rounded-md object-contain shrink-0 bg-white" />
              <span className="font-display font-bold text-xs" style={{ color: "var(--fg-primary)" }}>
                我的职业规划ai导师
              </span>
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#10b981" }} />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#10b981" }}>All Systems Operational</span>
            </div>
          </div>

          {/* Center: Links */}
          <div className="flex items-center gap-5 flex-wrap justify-center">
            {[
              { label: "Features", href: "#features" },
              { label: "How It Works", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
              { label: "FAQ", href: "#faq" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => { e.preventDefault(); scrollTo(link.href); }}
                className="text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer hover:underline"
                style={{ color: "var(--fg-muted)" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right: Copyright + Builder */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
              &copy; 2026
            </span>
            <a
              href="https://my-portfolio-anil.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded transition-all"
              style={{
                color: "var(--fg-secondary)",
                background: "var(--bg-muted)",
                border: "1px solid var(--border-default)"
              }}
            >
              Built by Anil Pradhan &rarr;
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
