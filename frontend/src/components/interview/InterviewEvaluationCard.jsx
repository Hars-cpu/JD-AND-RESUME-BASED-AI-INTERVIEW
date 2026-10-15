/**
 * @file InterviewEvaluationCard.jsx
 * @summary Real-time feedback and final scorecard visualizer for mock interview sessions.
 *          It displays progress bars and scores for individual answers (Accuracy, Completeness, etc.) 
 *          and triggers particle-burst animations upon rendering the final comprehensive placement-readiness scorecard.
 * 
 * @functions
 * - ScorePill: Helper widget displaying a metrics value (out of 100) colored dynamically according to score tiers.
 * - ProgressBar: Renders styled percentage loaders to visualize individual answer quality dimensions.
 * - getRecommendationBadge: Maps AI hiring decisions (Hire, Reject, Weak Hire) to color-coded indicator chips.
 * - useEffect (Celebration): Spawns custom animated floating particles when the session completes and the scorecard loads.
 * - InterviewEvaluationCard: Main functional component mapping active evaluations or complete scorecard listings.
 */

import React from "react";
import { ClipboardCheck, Trophy, Sparkles, CheckCircle2, ChevronRight } from "lucide-react";

const scoreFields = [
  ["Score", "score"],
  ["Accuracy", "technicalAccuracy"],
  ["Completeness", "completeness"],
  ["Communication", "communication"],
  ["Depth", "depth"],
  ["Practical Know", "practicalKnowledge"]
];

function ScorePill({ label, value }) {
  const val = Number(value) || 0;
  const getColorClass = (v) => {
    if (v >= 80) return "text-emerald-400";
    if (v >= 60) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-xl font-black mt-1 flex items-baseline gap-0.5 ${getColorClass(val)}`}>
        <span>{val}</span>
        <span className="text-[10px] text-slate-600 font-bold">/100</span>
      </div>
    </div>
  );
}

function ProgressBar({ label, value }) {
  const val = Number(value) || 0;
  const getColorClass = (v) => {
    if (v >= 80) return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]";
    if (v >= 60) return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]";
    return "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.3)]";
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-bold text-slate-300 select-none">
        <span>{label}</span>
        <span className="font-extrabold">{val}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${getColorClass(val)}`} 
          style={{ width: `${val}%` }} 
        />
      </div>
    </div>
  );
}

function InterviewEvaluationCard({ evaluation, scorecard }) {
  const [particles, setParticles] = React.useState([]);

  React.useEffect(() => {
    if (scorecard) {
      const colors = ["#34d399", "#22d3ee", "#fbbf24", "#a78bfa", "#f87171", "#60a5fa"];
      const generated = Array.from({ length: 35 }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 100;
        const x = Math.cos(angle) * distance;
        return {
          id: i,
          x: `${x}px`,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: `${Math.random() * 0.25}s`,
          left: `${50 + (Math.random() * 12 - 6)}%`,
          top: `${30 + (Math.random() * 12 - 6)}%`
        };
      });
      setParticles(generated);
      const timer = setTimeout(() => setParticles([]), 2500);
      return () => clearTimeout(timer);
    }
  }, [scorecard]);

  const getRecommendationBadge = (rec) => {
    const text = String(rec || "").toLowerCase();
    if (text.includes("strong hire") || text.includes("hire")) {
      return "premium-badge-green font-black tracking-wider text-xs uppercase px-3 py-1.5 animate-glow-pulse";
    }
    if (text.includes("no hire") || text.includes("reject")) {
      return "premium-badge-red font-black tracking-wider text-xs uppercase px-3 py-1.5";
    }
    return "premium-badge-amber font-black tracking-wider text-xs uppercase px-3 py-1.5";
  };

  if (scorecard) {
    return (
      <section className="premium-card overflow-hidden bg-slate-900/60 shadow-xl border border-white/8 relative">
        {/* Confetti Particle Emitter Overlay */}
        {particles.map((p) => (
          <span
            key={p.id}
            className="celebration-particle"
            style={{
              "--x": p.x,
              backgroundColor: p.color,
              animationDelay: p.delay,
              left: p.left,
              top: p.top
            }}
          />
        ))}

        <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 flex items-center justify-center shadow-lg animate-bounce">
              <Trophy size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-heading tracking-tight">Final Scorecard</h2>
              <p className="text-xs text-slate-400 mt-1">Mock interview complete summary</p>
            </div>
          </div>
          <span className={getRecommendationBadge(scorecard.hireRecommendation)}>
            {scorecard.hireRecommendation || "Completed"}
          </span>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <ScorePill label="Overall Score" value={scorecard.overallScore} />
            <ScorePill label="Technical Core" value={scorecard.technicalScore} />
            <ScorePill label="Communication" value={scorecard.communicationScore} />
            <ScorePill label="Problem Solving" value={scorecard.problemSolvingScore} />
            <div className="col-span-2">
              <ScorePill label="Project Discussion" value={scorecard.projectDiscussionScore} />
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4 text-sm leading-relaxed text-slate-200">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
              <Sparkles size={12} className="text-emerald-400" />
              <span>AI Executive Summary</span>
            </h3>
            <p>{scorecard.interviewSummary}</p>
          </div>

          {[
            ["Key Strengths", scorecard.strengths, "border-emerald-500/15 bg-emerald-500/5 text-slate-200"],
            ["Weaknesses & Gaps", scorecard.weaknesses, "border-red-500/15 bg-red-500/5 text-slate-200"],
            ["Actionable Recommendations", scorecard.recommendations, "border-blue-500/15 bg-blue-500/5 text-slate-200"]
          ].map(([title, items, borderStyle]) => (
            <div key={title} className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
              <ul className="space-y-2">
                {(items || []).map((item, idx) => (
                  <li key={idx} className={`text-xs leading-relaxed border rounded-xl px-3.5 py-3 flex items-start gap-2 ${borderStyle}`}>
                    <ChevronRight size={14} className="shrink-0 mt-0.5 text-slate-500" />
                    <span>{item}</span>
                  </li>
                ))}
                {(items || []).length === 0 && (
                  <li className="text-xs text-slate-500 italic">No points listed.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 shadow-xl border border-white/8">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 flex items-center justify-center shadow-lg">
          <ClipboardCheck size={18} />
        </div>
        <div>
          <h2 className="text-base font-black text-white font-heading tracking-tight">Answer Evaluation</h2>
          <p className="text-xs text-slate-400 mt-1">Real-time analytical feedback</p>
        </div>
      </div>

      <div className="p-5">
        {!evaluation ? (
          <div className="min-h-[160px] flex flex-col items-center justify-center text-center text-slate-500 px-4">
            <ClipboardCheck size={26} className="mb-2.5 text-slate-600" />
            <p className="text-sm font-black text-slate-400">Feedback Pending</p>
            <p className="text-xs text-slate-500 mt-1">Submit your response to see a detailed score assessment.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Dimension Progress bars */}
            <div className="space-y-4">
              {scoreFields.map(([label, key]) => (
                <ProgressBar key={key} label={label} value={evaluation[key]} />
              ))}
            </div>

            {evaluation.overallFeedback && (
              <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4 text-xs leading-relaxed text-slate-200 mt-4">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Evaluation Feedback</span>
                </h3>
                <p>{evaluation.overallFeedback}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default InterviewEvaluationCard;
