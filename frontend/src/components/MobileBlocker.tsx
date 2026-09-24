"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

export default function MobileBlocker() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      // 1024px is standard desktop breakpoint (lg in Tailwind)
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-[#07080d] flex flex-col items-center justify-center p-8 text-center select-none font-sans">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[250px] h-[250px] bg-pink-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Blocker Card */}
      <div className="relative z-10 max-w-sm w-full p-8 rounded-[2rem] bg-[#0d0f17]/80 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col items-center">
        <Image
          src="/brand-icon.png"
          alt="我的职业规划ai导师"
          width={64}
          height={64}
          className="w-16 h-16 rounded-2xl object-contain bg-white mb-6 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
        />

        {/* Text Details */}
        <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
          Desktop Only
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
          This website cannot support on this device. Please use a desktop or laptop computer to access 我的职业规划ai导师.
        </p>

        {/* Pulsing indicator */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
          </span>
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            Platform Online
          </span>
        </div>
      </div>
    </div>
  );
}
