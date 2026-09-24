"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";

const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
];

export default function Navbar() {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                transition: "all 0.3s ease",
                background: "rgba(2, 8, 23, 0.9)",
                backdropFilter: "blur(16px)",
                borderBottom: "1px solid rgba(148,163,184,0.1)",
                padding: "0 24px",
            }}
        >
            <div
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: "68px",
                }}
            >
                {/* Logo */}
                <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
                    <img src="/brand-icon.png" alt="我的职业规划ai导师" style={{ width: "36px", height: "36px", objectFit: "contain", flexShrink: 0, borderRadius: "8px", background: "white" }} />
                    <span
                        style={{
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 700,
                            fontSize: "18px",
                            color: "#f1f5f9",
                        }}
                    >
                        我的职业规划ai导师
                    </span>
                </Link>

                {/* Desktop Links */}
                <div style={{ display: "flex", alignItems: "center", gap: "32px" }} className="hide-mobile">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            style={{
                                color: "#94a3b8",
                                textDecoration: "none",
                                fontSize: "14px",
                                fontWeight: 500,
                                transition: "color 0.2s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#f1f5f9")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                {/* CTA Button */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Link href="/dashboard">
                        <button
                            className="btn-glow"
                            style={{ padding: "10px 22px", fontSize: "14px", fontWeight: 600, background: "linear-gradient(135deg, #10b981, #3b82f6)", border: "none", color: "white", borderRadius: "10px", cursor: "pointer" }}
                            id="navbar-get-started-btn"
                        >
                            <span>Open Career Workspace</span>
                        </button>
                    </Link>
                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "none" }}
                        className="show-mobile"
                        id="navbar-menu-btn"
                    >
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div
                    className="glass"
                    style={{ margin: "0 16px 16px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}
                >
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            style={{ color: "#94a3b8", textDecoration: "none", fontSize: "15px", padding: "8px 0" }}
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </nav>
    );
}
