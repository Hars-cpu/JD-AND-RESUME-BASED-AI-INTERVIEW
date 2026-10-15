/**
 * @file Admin.jsx
 * @description Admin portal workbench dashboard for ALGOPILOT.
 * Provides controls for content management, problem creation/updates/deletions,
 * database audits, and solution video uploads.
 */

import React, { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Video, 
  Sliders, 
  ShieldAlert, 
  CheckCircle2, 
  Activity, 
  ChevronRight, 
  ArrowLeft 
} from "lucide-react";
import axiosClient from "../utils/axiosClient";
import AppShell from "../components/layout/AppShell";

const adminOptions = [
  {
    id: "create",
    title: "Create Coding Problem",
    description: "Publish a new coding problem complete with examples, starter templates, compile configurations, and reference test cases.",
    icon: Plus,
    route: "/admin/problems/create",
    tone: "emerald"
  },
  {
    id: "update",
    title: "Modify & Edit Problems",
    description: "Open the active workspace directory, browse existing sandbox challenges, and edit compilation or details templates.",
    icon: Edit,
    route: "/problems",
    tone: "amber"
  },
  {
    id: "delete",
    title: "Deprecate & Delete Problems",
    description: "Review outdated or incorrect coding problems and permanently purge them from active candidate mock databases.",
    icon: Trash2,
    route: "/admin/delete",
    tone: "rose"
  },
  {
    id: "video",
    title: "Editorial Video Solutions",
    description: "Upload, map, or remove high-quality step-by-step video editorials explaining algorithmic concepts to candidates.",
    icon: Video,
    route: "/admin/video",
    tone: "sky"
  }
];

const toneClasses = {
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.1)] hover:border-emerald-400/40",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.1)] hover:border-amber-400/40",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(248,113,113,0.1)] hover:border-rose-400/40",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-400 shadow-[0_0_15px_rgba(96,165,250,0.1)] hover:border-sky-400/40"
};

/**
 * AdminMetricCard Component
 * Renders a metric card container for admin-specific platform metrics.
 */
function AdminMetricCard({ label, value, caption, icon: Icon, color = "emerald" }) {
  const borderCol = {
    emerald: "border-l-4 border-l-emerald-400",
    blue: "border-l-4 border-l-blue-400",
    amber: "border-l-4 border-l-amber-400"
  };
  return (
    <div className={`premium-card p-5 border border-white/8 bg-slate-900/60 shadow-xl flex items-center justify-between ${borderCol[color]}`}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black text-white font-heading tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-slate-400 font-semibold">{caption}</p>
      </div>
      <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/5 bg-white/5 text-slate-300">
        <Icon size={20} />
      </div>
    </div>
  );
}

/**
 * Admin Panel Main Component
 * Renders the workbench workspace tools deck and queries statistical metadata.
 */
function Admin() {
  const [totalProblems, setTotalProblems] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch admin diagnostics and aggregate count of live problems on component mount
  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const [res] = await Promise.allSettled([
          axiosClient.get("/problem/getAllProblem")
        ]);
        if (res.status === "fulfilled") {
          const list = res.value.data || [];
          // Resolve standard array length or fallback property fields
          const count = Array.isArray(list) ? list.length : Array.isArray(list.problems) ? list.problems.length : 0;
          setTotalProblems(count);
        }
      } catch (error) {
        console.error("Error loading admin stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAdminStats();
  }, []);

  return (
    // AppShell: Global page container incorporating sidebar navigation and premium headings
    <AppShell
      title="Admin Platform Workbench"
      subtitle="Complete database admin utilities for adding test suites, tracking code templates, video tutorials, and deprecations."
      actions={
        // Link to return to user facing workspace problems list
        <NavLink to="/problems" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5">
          <ArrowLeft size={13} />
          <span>Exit Admin</span>
        </NavLink>
      }
    >
      {/* Top Admin Stats Panel: Highlights global engine status and database metric totals */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <AdminMetricCard 
          label="Total Database Problems" 
          value={loading ? "..." : totalProblems} 
          caption="Problems live on workspace index" 
          icon={Activity} 
          color="emerald" 
        />
        <AdminMetricCard 
          label="Platform API Engine" 
          value="Online" 
          caption="Judge0 & MERN clusters connected" 
          icon={CheckCircle2} 
          color="blue" 
        />
        <AdminMetricCard 
          label="Management Tools" 
          value="4 Suite" 
          caption="Active control utilities ready" 
          icon={Sliders} 
          color="amber" 
        />
      </div>

      {/* Main Tools Deck */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {adminOptions.map((option) => {
          const Icon = option.icon;
          return (
            <NavLink
              key={option.id}
              to={option.route}
              className="premium-card group block p-5 bg-slate-900/60 border border-white/8 hover:border-emerald-500/20 shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[260px]"
            >
              <div>
                <div className={`grid h-14 w-14 place-items-center rounded-2xl border transition-all duration-300 ${toneClasses[option.tone]}`}>
                  <Icon size={24} className="group-hover:scale-105" />
                </div>
                <h2 className="mt-5 text-lg font-black text-white font-heading leading-tight">{option.title}</h2>
                <p className="mt-2.5 text-xs leading-relaxed text-slate-400 font-semibold">{option.description}</p>
              </div>

              <div className="mt-5 flex items-center justify-between text-xs font-bold text-slate-200 border-t border-white/5 pt-3.5 group-hover:text-emerald-400 transition-colors">
                <span>Access Utility</span>
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
            </NavLink>
          );
        })}
      </div>

      {/* Admin Audit Notes / System Info Card */}
      <section className="premium-card mt-6 p-5 bg-slate-900/60 border border-white/8 shadow-xl">
        <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-4">
          <ShieldAlert size={16} className="text-amber-400 animate-glow-pulse" />
          <span>System Operation Rules</span>
        </h2>
        
        <div className="grid gap-3.5 md:grid-cols-3">
          {[
            ["Problem Registry", "Creation and imports automatically propagate test configurations globally to all candidate profiles."],
            ["Compilers", "Modifying sandbox layouts syncs Monaco properties. Ensure hidden test files correspond to exact backend specifications."],
            ["Streaming Video", "Video editorials maps via direct link IDs. Always verify mapping against valid index identifiers."]
          ].map(([heading, desc]) => (
            <div key={heading} className="rounded-2xl border border-white/5 bg-slate-950/40 p-4 shadow-inner flex flex-col gap-1.5">
              <h3 className="text-xs font-black text-white font-heading">{heading}</h3>
              <p className="text-xs leading-relaxed text-slate-400 font-semibold">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

export default Admin;
