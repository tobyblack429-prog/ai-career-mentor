"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavClick = (href: string) => {
    setMenuOpen(false);
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "all 0.3s ease",
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 24px",
      }}
    >
      <div
        className="mx-auto flex items-center justify-between"
        style={{ maxWidth: "1200px", height: "60px" }}
      >
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
          <img src="/icon.svg" alt="CareerMentor.ai" className="w-8 h-8 object-contain shrink-0" />
          <span
            className="font-display font-bold"
            style={{
              fontSize: "1rem",
              color: "var(--fg-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            CareerMentor
              <span style={{ color: "var(--brand)" }}>.ai</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "32px" }} className="hide-mobile">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
              style={{
                color: "var(--fg-muted)",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 500,
                transition: "color 0.15s",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg-primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <button
              className="btn btn-primary"
              style={{ padding: "8px 18px", fontSize: "0.8125rem", fontWeight: 600 }}
              id="navbar-get-started-btn"
            >
              Open Career Workspace
            </button>
          </Link>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", display: "none" }}
            className="show-mobile"
            id="navbar-menu-btn"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          className="mx-4 mb-4 p-4 flex flex-col gap-3"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
              style={{ color: "var(--fg-secondary)", textDecoration: "none", fontSize: "0.9375rem", padding: "8px 0", cursor: "pointer" }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}
