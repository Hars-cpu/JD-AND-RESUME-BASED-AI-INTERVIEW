/**
 * @file AuthBrandPanel.jsx
 * @summary Left brand panel rendering the hero dashboard layout on login and sign-up pages.
 *          Displays application name logo, marketing statistics cards, bullet checklist cards of 8 key features 
 *          with staggered floating motion delays, and developer credentials badge.
 * 
 * @functions
 * - AuthLogo: Displays the brand logo and subtitle matching the sidebar branding.
 * - FloatingFeature: Child card component representing one key feature (e.g. DSA, Mock Interviews) 
 *                    running on a floating animation delay.
 * - AuthBrandPanel: Main layout component arranging the logo, taglines, stats summary tiles, 
 *                    and floating feature cards.
 */

import React from "react";
import {
  Award,
  BarChart3,
  BrainCircuit,
  Code2,
  FileSearch,
  Map,
  Mic,
  Sparkles,
  Trophy,
  User
} from "lucide-react";

const features = [
  { label: "Solve DSA Problems", icon: Code2, tone: "text-emerald-300", delay: "0ms" },
  { label: "AI Doubt Solving", icon: Sparkles, tone: "text-cyan-300", delay: "120ms" },
  { label: "Voice Mock Interviews", icon: Mic, tone: "text-blue-300", delay: "240ms" },
  { label: "Resume + JD Analysis", icon: FileSearch, tone: "text-amber-300", delay: "360ms" },
  { label: "Learning Roadmaps", icon: Map, tone: "text-violet-300", delay: "480ms" },
  { label: "Performance Analytics", icon: BarChart3, tone: "text-indigo-300", delay: "600ms" },
  { label: "Public Portfolio Profiles", icon: User, tone: "text-pink-300", delay: "720ms" },
  { label: "Gamified Achievements", icon: Award, tone: "text-rose-300", delay: "840ms" }
];

const stats = [
  ["Code", "Algorithm Practice"],
  ["Interview", "AI Voice Copilot"],
  ["Analyze", "Real-time Metrics"]
];

function AuthLogo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200 shadow-[0_0_35px_rgba(52,211,153,0.2)]">
        <img src="/logo.png" alt="ALGOPILOT Logo" className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
      </div>
      <div>
        <p className={`${compact ? "text-xl" : "text-2xl"} font-black tracking-tight text-white font-heading`}>
          ALGOPILOT
        </p>
        {!compact && (
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/70">
            AI coding & interview companion
          </p>
        )}
      </div>
    </div>
  );
}

function FloatingFeature({ feature, index }) {
  const Icon = feature.icon;

  return (
    <div
      className="auth-floating-card group"
      style={{ animationDelay: feature.delay }}
    >
      <div className={`grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 shrink-0 ${feature.tone}`}>
        <Icon size={17} />
      </div>
      <span className="text-xs sm:text-sm font-bold text-slate-100 leading-snug break-words flex-1 min-w-0">{feature.label}</span>
    </div>
  );
}

function AuthBrandPanel() {
  return (
    <section className="relative hidden min-h-screen w-1/2 overflow-hidden border-r border-white/10 bg-slate-950 px-8 py-6 lg:flex xl:px-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(52,211,153,0.20),transparent_28%),radial-gradient(circle_at_76%_30%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(145deg,#020617_0%,#08111f_48%,#020617_100%)]" />
      <div className="absolute inset-0 grid-pattern-overlay opacity-30" />
      <div className="absolute left-16 top-28 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
      <div className="absolute bottom-20 right-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 flex w-full flex-col justify-center gap-5 xl:gap-6">
        <AuthLogo />

        <div className="w-full max-w-2xl mt-2">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
            <BrainCircuit size={13} />
            Career readiness cockpit
          </div>
          <h1 className="w-full max-w-2xl text-4xl xl:text-[3.4rem] font-black leading-[1.1] tracking-tight text-white">
            Master DSA. Crack interviews. Accelerate your career.
          </h1>
          <p className="mt-4 w-full max-w-xl text-sm font-medium leading-relaxed text-slate-300">
            ALGOPILOT unifies coding practice, AI mentoring, resume analysis, voice interviews, analytics, roadmaps, and achievements in one focused workspace.
          </p>

          <div className="mt-5 grid w-full max-w-xl grid-cols-3 gap-3">
            {stats.map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
                <p className="text-xl font-black text-white font-heading">{value}</p>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Cards Container */}
        <div className="relative w-full max-w-2xl">
          <div className="relative rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-sm font-black text-white">Preparation System</p>
                <p className="text-[11px] font-semibold text-slate-400">Personalized every session</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-black text-emerald-200">
                <BarChart3 size={12} />
                Live Analytics
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {features.map((feature, index) => (
                <FloatingFeature key={feature.label} feature={feature} index={index} />
              ))}
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200 shadow-[0_0_35px_rgba(251,191,36,0.18)] auth-orbit">
            <Trophy size={20} />
          </div>
        </div>

        {/* Creator Badge */}
        <div className="mt-1 flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.02] py-1.5 px-3 w-fit">
          <div className="text-[11px] font-medium text-slate-400">Created by <span className="text-emerald-300 font-bold">Pradeep Modak</span></div>
          <div className="h-3 w-px bg-white/20"></div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Student, NIT Jamshedpur</div>
        </div>
      </div>
    </section>
  );
}

export { AuthLogo };
export default AuthBrandPanel;
