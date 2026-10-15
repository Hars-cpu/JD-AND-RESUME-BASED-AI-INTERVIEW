/**
 * @file LearningRoadmap.jsx
 * @description Candidate preparation syllabus and learning roadmap page.
 * Analyzes interview history to design curated learning timelines (7, 14, and 30-day sprints),
 * priorities focus topics, and lists recommended study resources.
 */

import React, { useEffect, useState } from "react";
import { NavLink } from "react-router";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clock3,
  Compass,
  Download,
  Target,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Zap,
  BookOpenCheck
} from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import AppShell from "../../components/layout/AppShell";
import { EmptyState, ErrorState, LoadingSkeleton, Toast } from "../../components/interview/FeedbackUI";

// Default empty fallback values for study timelines
const emptyRoadmap = {
  focusAreas: [],
  priorityTopics: [],
  sevenDayPlan: [],
  fourteenDayPlan: [],
  thirtyDayPlan: [],
  recommendedResources: [],
  estimatedImprovement: "",
  mentorAdvice: ""
};

/**
 * Formats current date for file exports (e.g. 2026_10_09).
 * @param {Date} date - Date object
 * @returns {string} Formatted string
 */
const formatFileDate = (date = new Date()) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}_${month}_${day}`;
};

/**
 * Triggers a browser-based download of binary file objects (Blobs).
 * @param {Blob} blob - Binary data object
 * @param {string} filename - Targeted file name output
 */
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * ProgressCard Component
 * Displays statistical milestones and metrics within the roadmap.
 */
function ProgressCard({ title, value, caption, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "from-emerald-950/30 to-emerald-900/5 text-emerald-300 border-emerald-500/20 border-l-4 border-l-emerald-400",
    blue: "from-blue-950/30 to-blue-900/5 text-blue-300 border-blue-500/20 border-l-4 border-l-blue-400",
    amber: "from-amber-950/30 to-amber-900/5 text-amber-300 border-amber-500/20 border-l-4 border-l-amber-400"
  };

  return (
    <div className={`premium-card bg-gradient-to-br p-5 flex flex-col justify-between relative overflow-hidden ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
          <p className={`font-black text-white mt-3 font-heading tracking-tight ${String(value).length > 10 ? 'text-base leading-snug line-clamp-3' : 'text-3xl'}`}>{value}</p>
          {caption && <p className="text-xs text-slate-400 mt-2 font-semibold line-clamp-1">{caption}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-slate-300 flex items-center justify-center shadow-inner shrink-0">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function BadgeList({ title, items, emptyText, icon: Icon }) {
  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2 shrink-0">
        <Icon size={16} className="text-emerald-400 animate-glow-pulse" />
        <h2 className="text-sm font-black text-white font-heading tracking-tight">{title}</h2>
      </div>
      <div className="p-5 flex flex-wrap gap-2 bg-slate-950/20 flex-1 content-start">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-1">{emptyText}</p>
        ) : (
          items.map((item) => (
            <span
              key={item}
              className="premium-badge-green text-[10px] py-1.5 px-3 font-extrabold uppercase"
            >
              {item}
            </span>
          ))
        )}
      </div>
    </section>
  );
}

function TimelineSection({ title, subtitle, items, marker }) {
  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 shrink-0">
        <h2 className="text-sm font-black text-white font-heading tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
      <div className="p-5 bg-slate-950/20 flex-1">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500 italic px-1">No roadmap steps available yet.</p>
        ) : (
          <ol className="relative border-l border-emerald-500/20 ml-3.5 space-y-4">
            {items.map((item, index) => (
              <li key={`${item}-${index}`} className="pl-6">
                <span className="absolute -left-3.5 w-7 h-7 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-400 text-[10px] font-black flex items-center justify-center shadow-lg">
                  {marker || index + 1}
                </span>
                <div className="rounded-xl border border-white/5 bg-slate-900/40 px-3.5 py-3 shadow-inner">
                  <p className="text-xs font-semibold text-slate-300 leading-relaxed">{item}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function LearningRoadmap() {
  const [roadmap, setRoadmap] = useState(emptyRoadmap);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadRoadmap = async () => {
      try {
        const { data } = await axiosClient.get("/api/interview/roadmap");
        setRoadmap({ ...emptyRoadmap, ...data });
      } catch (loadError) {
        if (loadError.response?.status === 404) {
          setRoadmap(emptyRoadmap);
          setError("");
        } else {
          setError(loadError.response?.data?.error || "Failed to generate learning roadmap");
        }
      } finally {
        setLoading(false);
      }
    };

    loadRoadmap();
  }, []);

  const handleExportRoadmap = async () => {
    try {
      setError("");
      setExporting(true);
      const response = await axiosClient.get("/api/interview/roadmap/pdf", {
        responseType: "blob"
      });
      downloadBlob(response.data, `Learning_Roadmap_${formatFileDate()}.pdf`);
      setToast({
        title: "PDF downloaded",
        message: "Your learning roadmap was exported successfully."
      });
    } catch (exportError) {
      setError(exportError.response?.data?.error || "Failed to export learning roadmap PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton title="Loading learning roadmap" rows={3} />;
  }

  return (
    <AppShell
      title="Learning Roadmap"
      subtitle="Your personalized placement preparation tracks, generated from historical mock sessions."
      actions={
        <>
          <NavLink to="/dashboard" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5">
            <ArrowLeft size={13} />
            <span>Dashboard</span>
          </NavLink>
          <button
            onClick={handleExportRoadmap}
            disabled={exporting}
            className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? "Exporting..." : "Export Roadmap PDF"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {error && <ErrorState title="Roadmap unavailable" message={error} onRetry={() => window.location.reload()} />}

        {!error && (
          <>
            {/* Metric counters grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ProgressCard
                title="Focus Areas"
                value={roadmap.focusAreas.length}
                caption="Primary technical gaps to close"
                icon={Target}
                tone="emerald"
              />
              <ProgressCard
                title="Priority Topics"
                value={roadmap.priorityTopics.length}
                caption="Highest leverage topics"
                icon={Compass}
                tone="blue"
              />
              <ProgressCard
                title="Estimated Gain"
                value={roadmap.estimatedImprovement || "-"}
                caption="Projected match score gain"
                icon={TrendingUp}
                tone="amber"
              />
            </div>

            {/* Badges and tracks section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <BadgeList title="Focus Areas" items={roadmap.focusAreas} emptyText="No focus areas returned yet." icon={Target} />
              <BadgeList title="Priority Topics" items={roadmap.priorityTopics} emptyText="No priority topics returned yet." icon={Compass} />
            </div>

            {roadmap.focusAreas.length === 0 && roadmap.priorityTopics.length === 0 && (
              <EmptyState
                title="No roadmap items yet"
                description="Complete a mock interview session and generate an AI scorecard to unlock your roadmap."
                icon={Compass}
              />
            )}

            {/* Timelines plans */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <TimelineSection
                title="7-Day Plan"
                subtitle="Immediate core revision & quick wins"
                items={roadmap.sevenDayPlan}
                marker="7"
              />
              <TimelineSection
                title="14-Day Plan"
                subtitle="Applied practice & structural repair"
                items={roadmap.fourteenDayPlan}
                marker="14"
              />
              <TimelineSection
                title="30-Day Plan"
                subtitle="Deeper mock preparation & executive reviews"
                items={roadmap.thirtyDayPlan}
                marker="30"
              />
            </div>

            {/* Recommended resources and mentor advisor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
                <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2 shrink-0">
                  <BookOpenCheck size={16} className="text-emerald-400 animate-glow-pulse" />
                  <h2 className="text-sm font-black text-white font-heading tracking-tight">Recommended Learning Resources</h2>
                </div>
                <div className="p-5 space-y-3.5 bg-slate-950/20 flex-1">
                  {roadmap.recommendedResources.length === 0 ? (
                    <p className="text-xs text-slate-500 italic px-1">No resources returned yet.</p>
                  ) : (
                    roadmap.recommendedResources.map((resource) => (
                      <div key={resource} className="rounded-xl border border-white/5 bg-slate-900/40 px-3.5 py-3 text-xs font-semibold text-slate-300 shadow-inner flex items-center justify-between gap-3 hover:border-emerald-500/20 transition-all">
                        <span>{resource}</span>
                        <ChevronRight size={14} className="text-slate-600 shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
                <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2 shrink-0">
                  <CalendarDays size={16} className="text-emerald-400 animate-glow-pulse" />
                  <h2 className="text-sm font-black text-white font-heading tracking-tight">System Mentor Advice</h2>
                </div>
                <div className="p-5 space-y-4 bg-slate-950/20 flex-1">
                  <div className="rounded-xl border border-white/5 bg-slate-900/40 p-4 shadow-inner">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      <Clock3 size={14} />
                      <span>Estimated Match Improvement</span>
                    </div>
                    <p className="text-base font-black text-emerald-400 mt-2 font-heading">{roadmap.estimatedImprovement || "Not calculated"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-900/40 p-4 text-xs leading-relaxed text-slate-300 shadow-inner">
                    {roadmap.mentorAdvice || "No mentor recommendations saved yet."}
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

export default LearningRoadmap;
