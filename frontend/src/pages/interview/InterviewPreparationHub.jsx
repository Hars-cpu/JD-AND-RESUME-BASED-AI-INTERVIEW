/**
 * @file InterviewPreparationHub.jsx
 * @summary Interview study track cockpit that guides candidates through study goals custom-generated from scorecards. 
 *          Retrieves study tracks, syncs completed topics to localStorage, renders a structured timeline, 
 *          and handles study plan PDF exports.
 * 
 * @functions
 * - readProgress: Reads the candidate's topics and tracks checkmark progress from localStorage.
 * - writeProgress: Saves the current candidate topic checkmark progress array back to localStorage.
 * - downloadBlob: Utility helper to instantiate temporary link elements and download PDF files.
 * - OverviewCard: Helper component rendering a metrics value, description, and Lucide icons.
 * - ProgressBar: Displays overall completion as a colored progress track.
 * - TrackCard: Displays study actions, practice tasks, outcomes, and progress toggles for an individual track.
 * - PreparationTimeline: Formats track checklists into a chronologically ordered vertical schedule list.
 * - InterviewPreparationHub: Main functional page component that loads preparation hub metadata from `/api/interview/preparation-hub`,
 *                              sorts tracks by priority, manages checkbox toggling states, and handles PDF export requests.
 */

import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Layers,
  Target,
  Trophy
} from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import AppShell from "../../components/layout/AppShell";
import { EmptyState, ErrorState, LoadingSkeleton, Toast } from "../../components/interview/FeedbackUI";

const STORAGE_KEY = "interviewPreparationHubProgress";

const emptyHub = {
  tracks: []
};

const formatFileDate = (date = new Date()) => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}_${month}_${day}`;
};

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

const priorityStyles = {
  High: "premium-badge-red text-[10px] py-0.5 px-2.5",
  Medium: "premium-badge-amber text-[10px] py-0.5 px-2.5",
  Low: "premium-badge-green text-[10px] py-0.5 px-2.5"
};

const readProgress = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      topics: {},
      tracks: {}
    };
  } catch {
    return {
      topics: {},
      tracks: {}
    };
  }
};

const writeProgress = (progress) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

const slug = (value) => String(value || "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const getTopicKey = (trackName, topic) => `${slug(trackName)}::${slug(topic)}`;
const getTrackKey = (trackName) => slug(trackName);

function OverviewCard({ title, value, caption, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "from-emerald-950/30 to-emerald-900/5 text-emerald-300 border-emerald-500/20 border-l-4 border-l-emerald-400",
    blue: "from-blue-950/30 to-blue-900/5 text-blue-300 border-blue-500/20 border-l-4 border-l-blue-400",
    amber: "from-amber-950/30 to-amber-900/5 text-amber-300 border-amber-500/20 border-l-4 border-l-amber-400",
    red: "from-red-950/30 to-red-900/5 text-red-300 border-red-500/20 border-l-4 border-l-red-400",
    violet: "from-violet-950/30 to-violet-900/5 text-violet-300 border-violet-500/20 border-l-4 border-l-violet-400"
  };

  return (
    <div className={`premium-card bg-gradient-to-br p-5 flex flex-col justify-between relative overflow-hidden ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
          <p className="text-3xl font-black text-white mt-3 font-heading tracking-tight">{value}</p>
          <p className="text-xs text-slate-400 mt-2 font-semibold">{caption}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-slate-300 flex items-center justify-center shadow-inner shrink-0">
          {React.createElement(Icon, { size: 18 })}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-950 border border-white/5 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.3)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function TrackCard({ track, progress, onToggleTopic, onToggleTrack }) {
  const trackKey = getTrackKey(track.name);
  const completedTopics = track.topics.filter((topic) => progress.topics[getTopicKey(track.name, topic)]).length;
  const topicProgress = track.topics.length ? Math.round((completedTopics / track.topics.length) * 100) : 0;
  const trackCompleted = Boolean(progress.tracks[trackKey]);

  return (
    <article className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
      <div className="p-5 border-b border-white/8 bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-black text-white font-heading leading-tight">{track.name}</h2>
              <span className={priorityStyles[track.priority] || priorityStyles.Low}>
                {track.priority} Priority
              </span>
              {trackCompleted && (
                <span className="premium-badge-green text-[10px] py-0.5 px-2.5 font-extrabold flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  Completed
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1.5 font-semibold">{track.estimatedDays} day action track</p>
          </div>
          
          <button
            onClick={() => onToggleTrack(track.name)}
            className="ghost-button text-xs py-2 px-4 shadow-md flex items-center gap-1.5 shrink-0"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{trackCompleted ? "Mark Active" : "Track Completed"}</span>
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 select-none">
            <span>Topic Progress</span>
            <span className="text-white">{topicProgress}%</span>
          </div>
          <ProgressBar value={topicProgress} />
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5 bg-slate-950/20">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 select-none">High Priority Topics</h3>
          <div className="space-y-2">
            {track.topics.map((topic) => {
              const topicKey = getTopicKey(track.name, topic);
              const checked = Boolean(progress.topics[topicKey]);

              return (
                <label key={topicKey} className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-slate-900/30 px-3.5 py-3 cursor-pointer select-none hover:bg-slate-900/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleTopic(track.name, topic)}
                    className="checkbox checkbox-xs checkbox-emerald rounded border-white/20 mt-0.5"
                  />
                  <span className={`text-xs font-semibold leading-relaxed ${checked ? "text-slate-500 line-through" : "text-slate-200"}`}>
                    {topic}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 select-none">Practice Tasks</h3>
          <div className="space-y-2">
            {track.practiceTasks.map((task) => (
              <div key={task} className="rounded-xl border border-white/5 bg-slate-900/30 px-3.5 py-3 text-xs font-semibold text-slate-300 leading-relaxed shadow-inner">
                {task}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 select-none">Expected Outcome</h3>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-4 py-3 text-xs font-semibold text-emerald-300 leading-relaxed shadow-inner">
            {track.expectedOutcome}
          </div>
        </div>
      </div>
    </article>
  );
}

function PreparationTimeline({ tracks }) {
  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40">
        <h2 className="text-sm font-black text-white font-heading tracking-tight">Timeline Schedule</h2>
        <p className="text-xs text-slate-400 mt-1">Track sequence mapped by priority and estimated effort</p>
      </div>
      <div className="p-5 bg-slate-950/20">
        <ol className="relative border-l border-emerald-500/20 ml-3.5 space-y-4">
          {tracks.map((track) => (
            <li key={track.name} className="pl-6">
              <span className="absolute -left-3.5 w-7 h-7 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
                <CalendarDays size={13} />
              </span>
              <div className="rounded-xl border border-white/5 bg-slate-900/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-inner">
                <div>
                  <p className="text-xs font-black text-white font-heading">{track.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-semibold">{track.topics.length} topics &middot; {track.practiceTasks.length} tasks</p>
                </div>
                <span className="text-xs font-extrabold text-emerald-400">{track.estimatedDays} days</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function InterviewPreparationHub() {
  const [hub, setHub] = useState(emptyHub);
  const [progress, setProgress] = useState(readProgress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadHub = async () => {
      try {
        const { data } = await axiosClient.get("/api/interview/preparation-hub");
        setHub({ ...emptyHub, ...data });
      } catch (loadError) {
        if (loadError.response?.status === 404) {
          setHub(emptyHub);
          setError("");
        } else {
          setError(loadError.response?.data?.error || "Failed to generate preparation hub");
        }
      } finally {
        setLoading(false);
      }
    };

    loadHub();
  }, []);

  useEffect(() => {
    writeProgress(progress);
  }, [progress]);

  const sortedTracks = useMemo(() => {
    const order = { High: 0, Medium: 1, Low: 2 };
    return [...hub.tracks].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  }, [hub.tracks]);

  const totalTopics = sortedTracks.reduce((sum, track) => sum + track.topics.length, 0);
  const completedTopics = sortedTracks.reduce((sum, track) => (
    sum + track.topics.filter((topic) => progress.topics[getTopicKey(track.name, topic)]).length
  ), 0);
  const completedTracks = sortedTracks.filter((track) => progress.tracks[getTrackKey(track.name)]).length;
  const highPriorityCount = sortedTracks.filter((track) => track.priority === "High").length;

  const toggleTopic = (trackName, topic) => {
    const key = getTopicKey(trackName, topic);
    setProgress((current) => ({
      ...current,
      topics: {
        ...current.topics,
        [key]: !current.topics[key]
      }
    }));
  };

  const toggleTrack = (trackName) => {
    const key = getTrackKey(trackName);
    setProgress((current) => ({
      ...current,
      tracks: {
        ...current.tracks,
        [key]: !current.tracks[key]
      }
    }));
  };

  const handleExportPlan = async () => {
    try {
      setError("");
      setExporting(true);
      const response = await axiosClient.get("/api/interview/preparation-hub/pdf", {
        responseType: "blob"
      });
      downloadBlob(response.data, `Preparation_Plan_${formatFileDate()}.pdf`);
      setToast({
        title: "PDF downloaded",
        message: "Your preparation plan was exported successfully."
      });
    } catch (exportError) {
      setError(exportError.response?.data?.error || "Failed to export preparation plan PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <LoadingSkeleton title="Loading preparation hub" rows={4} />;
  }

  return (
    <AppShell
      title="Preparation Hub"
      subtitle="Structured learning and execution modules designed for direct placement readiness."
      actions={
        <>
          <NavLink to="/dashboard" className="premium-muted-button px-4 py-2 text-xs flex items-center gap-1.5">
            <ArrowLeft size={13} />
            <span>Dashboard</span>
          </NavLink>
          <button
            onClick={handleExportPlan}
            disabled={exporting}
            className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? "Exporting..." : "Export Plan PDF"}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {error && <ErrorState title="Preparation hub unavailable" message={error} onRetry={() => window.location.reload()} />}

        {!error && (
          <>
            {/* Overview Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <OverviewCard title="Recommended Tracks" value={sortedTracks.length} caption="Personalized preparation modules" icon={Layers} tone="emerald" />
              <OverviewCard title="High Priority" value={highPriorityCount} caption="Critical paths to start first" icon={Target} tone="red" />
              <OverviewCard title="Topics Completed" value={`${completedTopics}/${totalTopics}`} caption="Active progress saved locally" icon={ClipboardCheck} tone="blue" />
              <OverviewCard title="Tracks Finished" value={`${completedTracks}/${sortedTracks.length}`} caption="Preparation readiness milestones" icon={Trophy} tone="amber" />
            </div>

            {/* Total progress stats */}
            <section className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl">
              <div className="flex items-center justify-between gap-4 mb-3.5 select-none">
                <div>
                  <h2 className="text-sm font-black text-white font-heading tracking-tight">Overall Topics Progress</h2>
                  <p className="text-xs text-slate-400 mt-1">Topic completion metrics across all preparation tracks</p>
                </div>
                <span className="text-sm font-black text-emerald-400">
                  {totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0}%
                </span>
              </div>
              <ProgressBar value={totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0} />
            </section>

            {/* Sorted track lists */}
            <div className="space-y-5">
              {sortedTracks.length === 0 ? (
                <EmptyState
                  title="No preparation tracks yet"
                  description="Unlock targeted prep modules by completing a mock session and scorecard."
                  icon={Layers}
                />
              ) : (
                sortedTracks.map((track) => (
                  <TrackCard
                    key={track.name}
                    track={track}
                    progress={progress}
                    onToggleTopic={toggleTopic}
                    onToggleTrack={toggleTrack}
                  />
                ))
              )}
            </div>

            {sortedTracks.length > 0 && <PreparationTimeline tracks={sortedTracks} />}

            {/* Aggregated Practice tasks list */}
            <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
              <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-2">
                <BookOpenCheck size={16} className="text-emerald-400 animate-glow-pulse" />
                <h2 className="text-sm font-black text-white font-heading tracking-tight">Aggregated Track Tasks Checklist</h2>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 bg-slate-950/20">
                {sortedTracks.flatMap((track) => (
                  track.practiceTasks.map((task) => (
                    <div key={`${track.name}-${task}`} className="rounded-xl border border-white/5 bg-slate-900/40 px-3.5 py-3 hover:border-emerald-500/20 transition-all flex flex-col justify-between shadow-inner min-h-[96px]">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{track.name}</p>
                      <p className="text-xs font-semibold text-slate-300 mt-2 leading-relaxed">{task}</p>
                    </div>
                  ))
                ))}
              </div>
            </section>
          </>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

export default InterviewPreparationHub;
