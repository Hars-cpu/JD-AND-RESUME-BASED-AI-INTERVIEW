/**
 * @file CodingQuestionCard.jsx
 * @summary Renders the details of an active coding question during coding mock rounds.
 *          If no question is active, shows a loading/pending state block. Otherwise, displays 
 *          problem title, difficulty levels, target topics, descriptions, list constraints, and example cases.
 * 
 * @functions
 * - CodingQuestionCard: Renders coding details (description, constraints, input/output samples) for candidate rounds.
 * - getDiffBadgeClass: Utility mapping problem difficulties (easy, medium, hard) to their visual CSS style classes.
 */

import React from "react";
import { Code2, ListChecks, ArrowRightCircle } from "lucide-react";

function CodingQuestionCard({ question }) {
  if (!question) {
    return (
      <section className="premium-card flex flex-col items-center justify-center text-center p-8 bg-slate-900/60 shadow-xl border border-white/8 min-h-[300px]">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.02] text-slate-500 mb-4 animate-glow-pulse">
          <Code2 size={28} />
        </div>
        <p className="text-sm font-black text-slate-300 font-heading">Coding round pending</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
          The coding problem has not been generated or started for this session yet.
        </p>
      </section>
    );
  }

  const description = question.description || question.message;

  const getDiffBadgeClass = (diff) => {
    const val = String(diff || "").toLowerCase();
    if (val.includes("easy")) return "premium-badge-green";
    if (val.includes("medium")) return "premium-badge-amber";
    if (val.includes("hard")) return "premium-badge-red";
    return "premium-badge-blue";
  };

  return (
    <section className="premium-card h-full flex flex-col bg-slate-900/60 shadow-xl border border-white/8 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-5 border-b border-white/8 bg-slate-900/40 shrink-0 z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-white font-heading leading-tight">{question.title}</h1>
            <div className="flex flex-wrap gap-2 mt-3.5">
              <span className={`${getDiffBadgeClass(question.difficulty)} py-0.5 px-2.5 text-[10px] font-black uppercase tracking-wider`}>
                {question.difficulty || "Medium"}
              </span>
              {(question.expectedTopics || []).map((topic) => (
                <span key={topic} className="premium-badge-blue py-0.5 px-2.5 text-[10px] font-extrabold uppercase">
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 flex items-center justify-center shrink-0 shadow-lg">
            <Code2 size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-6 flex-1 overflow-y-auto premium-scrollbar">
        {/* Description */}
        <div className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Problem Description</h2>
          <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{description}</p>
        </div>

        {/* Constraints */}
        {question.constraints && question.constraints.length > 0 && (
          <div className="space-y-2.5 pt-4 border-t border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Constraints</h2>
            <ul className="space-y-2.5">
              {(question.constraints || []).map((constraint, i) => (
                <li key={i} className="flex gap-2.5 text-xs font-semibold text-slate-300">
                  <ListChecks size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                  <span>{constraint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Examples */}
        {question.examples && question.examples.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Examples</h2>
            <div className="space-y-3.5">
              {(question.examples || []).map((example, index) => (
                <div key={`${example.input}-${index}`} className="rounded-xl border border-white/5 bg-slate-950/60 overflow-hidden shadow-inner">
                  <div className="px-3.5 py-2 border-b border-white/5 bg-slate-900/60 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <ArrowRightCircle size={12} className="text-emerald-400" />
                    <span>Example {index + 1}</span>
                  </div>
                  <div className="p-3.5 space-y-2 font-mono text-xs text-slate-300 select-all leading-relaxed">
                    <div>
                      <span className="font-extrabold text-slate-500">Input:</span> {example.input}
                    </div>
                    <div>
                      <span className="font-extrabold text-slate-500">Output:</span> {example.output}
                    </div>
                    {example.explanation && (
                      <div className="pt-1.5 border-t border-white/5 mt-1.5 text-slate-400 text-[11px] leading-relaxed">
                        <span className="font-extrabold text-slate-500">Explanation:</span> {example.explanation}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default CodingQuestionCard;
