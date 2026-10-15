/**
 * @file InterviewQuestionCard.jsx
 * @summary Visual card component that displays the current active question prompt in the mock interview.
 *          Renders metadata badges for problem difficulty, type category, source (follow-up vs main), 
 *          and an optional focus hint explaining the interviewer's reasoning.
 * 
 * @functions
 * - InterviewQuestionCard: Functional component rendering the question prompt, tags, and focus explanations.
 * - getDiffBadgeClass: Maps difficulty values (easy, medium, hard) to their respective CSS border and background badge classes.
 */

import React from "react";
import { Brain, Layers, Signal, HelpCircle } from "lucide-react";

function InterviewQuestionCard({ question, latestQuestionMeta }) {
  const hasQuestion = Boolean(question?.message || latestQuestionMeta?.question);
  const questionText = latestQuestionMeta?.question || question?.message || "Generate a question to begin the interview.";
  const category = latestQuestionMeta?.category || question?.category || "Practice General";
  const difficulty = latestQuestionMeta?.difficulty || question?.difficulty || "Select Difficulty";
  const source = latestQuestionMeta?.source || (question?.questionType === "follow-up" ? "follow-up" : "session");

  const getDiffBadgeClass = (diff) => {
    const val = String(diff).toLowerCase();
    if (val.includes("easy")) return "premium-badge-green";
    if (val.includes("medium")) return "pattern-amber premium-badge-amber";
    if (val.includes("hard")) return "premium-badge-red";
    return "premium-badge-blue";
  };

  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 shadow-xl border border-white/8">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white font-heading tracking-tight">Active Question</h2>
          <p className="text-xs text-slate-400 mt-1">Interviewer's current prompt</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 flex items-center justify-center shadow-lg">
          <Brain size={18} />
        </div>
      </div>

      <div className="p-5 space-y-5">
        <p className={`text-base leading-relaxed font-medium ${hasQuestion ? "text-slate-100" : "text-slate-500 italic"}`}>
          {questionText}
        </p>

        <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5">
          <span className="premium-badge-blue text-[10px] py-1 px-2.5 font-extrabold flex items-center gap-1.5 shadow-sm">
            <Layers size={12} />
            <span>Category: {category}</span>
          </span>
          
          <span className={`${getDiffBadgeClass(difficulty)} text-[10px] py-1 px-2.5 font-extrabold flex items-center gap-1.5 shadow-sm`}>
            <Signal size={12} />
            <span className="capitalize">{difficulty}</span>
          </span>
          
          <span className="premium-badge-violet text-[10px] py-1 px-2.5 font-extrabold flex items-center gap-1.5 shadow-sm">
            <HelpCircle size={12} />
            <span>Source: {source}</span>
          </span>
        </div>

        {latestQuestionMeta?.reason && (
          <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4 mt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">Interviewer Focus Hint</p>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">{latestQuestionMeta.reason}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default InterviewQuestionCard;
