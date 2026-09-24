"use client";

// Intercept and suppress Recharts / React 18 defaultProps deprecation warnings globally
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args) => {
    if (args[0] && typeof args[0] === "string" && (args[0].includes("defaultProps") || args[0].includes("Support for defaultProps"))) {
      return;
    }
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (args[0] && typeof args[0] === "string" && (args[0].includes("defaultProps") || args[0].includes("Support for defaultProps"))) {
      return;
    }
    originalWarn(...args);
  };
}

import { ReactNode, useEffect } from "react";
import Lenis from "lenis";
import MobileBlocker from "./MobileBlocker";
import { LanguageProvider } from "./LanguageProvider";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Initialize Lenis smooth scrolling with inertia
    const lenis = new Lenis({
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.8,
      touchMultiplier: 2.0,
    });

    let animationFrameId: number;

    function raf(time: number) {
      lenis.raf(time);
      animationFrameId = requestAnimationFrame(raf);
    }

    animationFrameId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(animationFrameId);
      lenis.destroy();
    };
  }, []);

  return (
    <LanguageProvider>
      <MobileBlocker />
      {children}
    </LanguageProvider>
  );
}
