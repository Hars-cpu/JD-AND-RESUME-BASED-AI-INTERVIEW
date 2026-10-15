/**
 * @file InterviewTranscript.jsx
 * @summary Live transcript visualizer for the AI Interview page. It displays a scrollable list of interview dialogue
 *          turns, styled according to the speaker's role (Interviewer, Candidate, AI Evaluation, or System).
 *          Automatically handles timeline auto-scrolling when new transcripts arrive.
 * 
 * @functions
 * - formatTime: Converts timestamps into standard "HH:MM AM/PM" client-side formats.
 * - EvaluationBody: Renders structured score metrics (Total, Technical, Communication) and feedback details.
 * - TranscriptItem: Dynamically aligns message bubbles based on sender role, attaching avatars and category badges.
 * - InterviewTranscript: Main exported component that manages the container ref, tracks content length, and scrolls to bottom on updates.
 */

import React, { useEffect, useRef } from "react";
import { Bot, CheckCircle2, User, HelpCircle } from "lucide-react";

const roleConfig = {
  interviewer: {
    label: "Interviewer",
    icon: Bot,
    bubble: "bg-slate-900 border border-white/5 text-slate-100 rounded-2xl rounded-tl-none shadow-md",
    avatar: "bg-slate-800 border border-white/10 text-emerald-400"
  },
  candidate: {
    label: "Candidate (You)",
    icon: User,
    bubble: "bg-emerald-500/8 border border-emerald-500/15 text-emerald-50 rounded-2xl rounded-tr-none shadow-md",
    avatar: "bg-gradient-to-br from-emerald-400 to-cyan-400 text-slate-950 font-black"
  },
  evaluation: {
    label: "AI Evaluation Round Turn",
    icon: CheckCircle2,
    bubble: "bg-amber-500/8 border border-amber-500/15 text-amber-50 rounded-2xl w-full shadow-md",
    avatar: "bg-amber-400/20 border border-amber-400/30 text-amber-300"
  },
  system: {
    label: "System",
    icon: HelpCircle,
    bubble: "bg-slate-950/80 border border-white/5 text-slate-300 rounded-2xl w-full",
    avatar: "bg-slate-800 text-slate-400"
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

function EvaluationBody({ item }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2.5">
        <span className="premium-badge-amber py-0.5 px-2.5 font-extrabold text-[10px]">
          Score: {item.score ?? 0}/100
        </span>
        <span className="premium-badge-green py-0.5 px-2.5 font-extrabold text-[10px]">
          Accuracy: {item.technicalAccuracy ?? 0}/100
        </span>
        <span className="premium-badge-blue py-0.5 px-2.5 font-extrabold text-[10px]">
          Communication: {item.communication ?? 0}/100
        </span>
      </div>
      {item.overallFeedback && (
        <div className="text-sm leading-relaxed text-slate-300 bg-white/[0.02] border border-white/5 rounded-xl p-3.5 mt-2">
          <p className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-1">Feedback</p>
          {item.overallFeedback}
        </div>
      )}
    </div>
  );
}

function TranscriptItem({ item }) {
  const config = roleConfig[item.role] || roleConfig.system;
  const Icon = config.icon;
  const isCandidate = item.role === "candidate";
  const isFullWidth = item.role === "evaluation" || item.role === "system";

  return (
    <div className={`flex gap-3.5 animate-transcript-in ${isCandidate ? "justify-end" : "justify-start"}`}>
      {!isCandidate && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${config.avatar}`}>
          <Icon size={18} />
        </div>
      )}

      <div className={`rounded-2xl px-4 py-3.5 border ${config.bubble} ${isFullWidth ? "w-full" : "max-w-[78%]"}`}>
        <div className="flex items-center justify-between gap-3 mb-2 border-b border-white/5 pb-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {config.label}
          </span>
          <span className="text-[10px] text-slate-500 font-bold">
            {formatTime(item.timestamp)}
          </span>
        </div>

        {item.role === "evaluation" ? (
          <EvaluationBody item={item} />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
            {item.message || item.feedback}
          </p>
        )}

        {item.category && item.role === "interviewer" && (
          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-white/5">
            <span className="premium-badge-blue py-0.5 px-2 text-[9px] font-black tracking-wider uppercase">
              {item.category}
            </span>
            {item.questionType && (
              <span className="premium-badge-violet py-0.5 px-2 text-[9px] font-black tracking-wider uppercase">
                {item.questionType}
              </span>
            )}
          </div>
        )}
      </div>

      {isCandidate && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${config.avatar}`}>
          <Icon size={18} />
        </div>
      )}
    </div>
  );
}

function InterviewTranscript({ transcript = [], compact = false }) {
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [transcript]);

  return (
    <section className={`premium-card flex flex-col overflow-hidden bg-slate-900/60 shadow-xl ${compact ? "h-[450px] xl:h-[48vh]" : "min-h-[450px]"}`}>
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40">
        <h2 className="text-base font-black text-white font-heading tracking-tight">Live Transcript</h2>
        <p className="text-xs text-slate-400 mt-1">Questions, answers, and visual feedback in chronological order</p>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-950/20 premium-scrollbar smooth-scroll"
      >
        {transcript.length === 0 ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center text-slate-500 px-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.02] text-slate-400 mb-4 animate-glow-pulse">
              <Bot size={28} />
            </div>
            <p className="text-sm font-black text-slate-300 font-heading">Generate a question to begin</p>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
              Your mock AI interviewer is waiting. Select difficulty and tap 'Generate Question' to get started!
            </p>
          </div>
        ) : (
          transcript.map((item, index) => (
            <TranscriptItem key={`${item.timestamp || "turn"}-${index}`} item={item} />
          ))
        )}
      </div>
    </section>
  );
}

export default InterviewTranscript;
