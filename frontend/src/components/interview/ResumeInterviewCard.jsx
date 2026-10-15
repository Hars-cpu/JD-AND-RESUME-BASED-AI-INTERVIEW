/**
 * @file ResumeInterviewCard.jsx
 * @summary Alert card component displayed at the top of the start panel when an active mock interview 
 *          session is detected. It displays active session statistics (questions, durations, timestamps) 
 *          and provides controls to continue (resume) or permanently discard the session via a modal confirmation.
 * 
 * @functions
 * - formatDateTime: Formats calendar dates into localized strings showing hours and minutes.
 * - formatDuration: Helper to parse elapsed seconds into a readable string format (e.g., "1h 30m" or "45m 12s").
 * - Stat: Render widget for displaying key-value pairs (like questions count, elapsed time) inside structured tiles.
 * - ResumeInterviewCard: Main functional component managing the session restore layout and discard confirmation state.
 */

import React, { useState } from "react";
import { AlertTriangle, Clock, MessageSquare, Play, RotateCcw, Trash2 } from "lucide-react";

const formatDateTime = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDuration = (seconds = 0) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
};

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 px-3.5 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-sm sm:text-base font-black text-white font-heading">{value}</p>
    </div>
  );
}

function ResumeInterviewCard({ session, loadingAction, onContinue, onDiscard }) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  if (!session) return null;

  return (
    <>
      <section className="premium-card overflow-hidden bg-gradient-to-br from-slate-900/60 to-slate-950/60 border border-white/8 border-l-4 border-l-emerald-400 p-0 shadow-2xl mb-6">
        <div className="px-5 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="premium-badge-green py-1 px-2.5 text-[10px] font-extrabold uppercase tracking-wider">
              <RotateCcw size={11} />
              Resume Active Mock Session
            </div>
            <h2 className="mt-3 text-lg font-black text-white capitalize font-heading">
              {session.templateType || "technical"} template
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              {session.interviewType || "Mock"} interview in progress
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onContinue(session.sessionId)}
              disabled={loadingAction === "resume"}
              className="premium-button text-xs py-2.5 px-4 shadow-lg cursor-pointer"
            >
              <Play size={14} className="fill-current" />
              <span>{loadingAction === "resume" ? "Loading..." : "Continue Session"}</span>
            </button>
            <button
              onClick={() => setConfirmingDiscard(true)}
              disabled={loadingAction === "discard"}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 size={14} />
              <span>Discard Session</span>
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Started" value={formatDateTime(session.startedAt)} />
          <Stat label="Duration" value={formatDuration(session.duration)} />
          <Stat label="Questions Asked" value={session.questionCount || 0} />
          <Stat label="Answers Submitted" value={session.answerCount || 0} />
          <Stat label="Follow-Up Turns" value={session.followUpCount || 0} />
          <Stat label="Last Activity" value={formatDateTime(session.lastActivity)} />
          
          <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3.5 sm:col-span-2 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <MessageSquare size={13} className="text-emerald-400" />
              <span>Session Restore Notice</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400 font-semibold">
              Live transcript, active speech context, editor syntax state, and difficulty level will be perfectly restored.
            </p>
          </div>
        </div>
      </section>

      {/* Discard Dialog Modal */}
      {confirmingDiscard && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-white/10 shadow-2xl p-6 animate-fade-up">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 shadow-md">
              <AlertTriangle size={20} />
            </div>
            <h3 className="mt-4 text-base sm:text-lg font-black text-white font-heading">
              Discard this interview session?
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-400 font-semibold">
              This will mark the active session as discarded and purge it from your dashboard suggestions. This action is permanent and cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setConfirmingDiscard(false)}
                className="ghost-button px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmingDiscard(false);
                  onDiscard(session.sessionId);
                }}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-500/20 text-slate-950 px-4 py-2 text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-600/10"
              >
                Discard Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ResumeInterviewCard;
