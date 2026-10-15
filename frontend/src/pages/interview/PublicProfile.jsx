/**
 * @file PublicProfile.jsx
 * @description Candidate public profile page for ALGOPILOT.
 * Displays achievements, performance stats, interview average scores,
 * solved problems heatmaps, and past score history tracking charts.
 */

import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router";
import { Award, BarChart3, Check, Code2, Copy, Medal, MessageSquare, Target, Trophy, User } from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import AppShell from "../../components/layout/AppShell";
import ActivityHeatmap from "../../components/ui/ActivityHeatmap";
import { EmptyState, ErrorState, LoadingSkeleton, Toast } from "../../components/interview/FeedbackUI";

// Default template for public profile state values
const emptyProfile = {
  username: "",
  joinedAt: "",
  totalInterviews: 0,
  averageScore: 0,
  bestScore: 0,
  codingInterviews: 0,
  technicalAverage: 0,
  communicationAverage: 0,
  problemSolvingAverage: 0,
  achievements: [],
  recentProgress: [],
  topStrengths: [],
  problemsSolved: 0,
  acceptanceRate: 0
};

/**
 * Formats timestamps into standard MM DD, YYYY strings.
 * @param {string|Date} date - Timestamp input
 * @returns {string} Formatted string
 */
const formatDate = (date) => {
  if (!date) return "-";
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

/**
 * StatCard Component
 * Displays statistical values inside card panels.
 */
function StatCard({ label, value, caption, icon: Icon }) {
  return (
    <article className="premium-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{caption}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

/**
 * SkillMeter Component
 * Displays average progress bar ratings for key metrics (Technical, Communication, etc.).
 */
function SkillMeter({ label, value, icon: Icon }) {
  const score = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <article className="premium-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
            <Icon size={19} />
          </div>
          <div>
            <h3 className="font-black text-white">{label}</h3>
            <p className="text-xs text-slate-500">Interview average</p>
          </div>
        </div>
        <span className="text-2xl font-black text-white">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${score}%` }} />
      </div>
    </article>
  );
}

function ProgressChart({ data }) {
  const width = 720;
  const height = 220;
  const padding = 28;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + (1 - (Number(item.overallScore) || 0) / 100) * chartHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <section className="premium-card overflow-hidden">
      <div className="border-b border-white/10 p-5">
        <h2 className="text-lg font-black text-white">Recent Progress</h2>
        <p className="mt-1 text-sm text-slate-400">Last 10 public interview scores</p>
      </div>
      <div className="overflow-x-auto p-5 premium-scrollbar">
        {data.length === 0 ? (
          <div className="grid h-56 place-items-center text-sm text-slate-500">No interview scores yet.</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px] w-full h-[240px]">
            {[0, 25, 50, 75, 100].map((score) => {
              const y = padding + (1 - score / 100) * chartHeight;
              return (
                <g key={score}>
                  <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
                  <text x={4} y={y + 4} fontSize="10" fill="#64748B">{score}</text>
                </g>
              );
            })}
            <polyline points={points} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((item, index) => {
              const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * chartWidth;
              const y = padding + (1 - (Number(item.overallScore) || 0) / 100) * chartHeight;
              return (
                <g key={item.reportId || index}>
                  <circle cx={x} cy={y} r="5" fill="#22d3ee" />
                  <text x={x - 10} y={y - 11} fontSize="11" fill="#E2E8F0">{item.overallScore}</text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </section>
  );
}

function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await axiosClient.get(`/api/profile/${username}`);
        setProfile({ ...emptyProfile, ...data });
      } catch (loadError) {
        setError(loadError.response?.data?.error || "Failed to load public profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [username]);

  const hasInterviews = profile.totalInterviews > 0 || profile.recentProgress.length > 0;
  const heatmapActivity = useMemo(() => {
    const interviewItems = profile.recentProgress.map((item) => ({ date: item.date || item.createdAt, count: 1 }));
    const codingItems = (profile.codingActivity || []).map((item) => ({ date: item.date || item.createdAt, count: 1 }));
    return [...interviewItems, ...codingItems];
  }, [profile.recentProgress, profile.codingActivity]);

  const copyProfileLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setToast({ title: "Profile link copied", message: "Shareable public profile link copied." });
      setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      setError("Unable to copy profile link");
    }
  };

  if (loading) return <LoadingSkeleton title="Loading public profile" rows={3} />;

  return (
    <AppShell
      title={`@${profile.username || username}`}
      subtitle="A privacy-safe public interview profile showing aggregated performance, achievements, recent progress, and top strengths."
      actions={
        <>
          <button onClick={copyProfileLink} className="premium-button inline-flex items-center gap-2 px-4 py-2 text-sm">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy Profile Link"}
          </button>
          <NavLink to="/dashboard" className="premium-muted-button px-4 py-2 text-sm">Dashboard</NavLink>
        </>
      }
    >
      {error && <ErrorState title="Profile unavailable" message={error} onRetry={() => window.location.reload()} />}

      {!error && (
        <div className="space-y-6">
          {/* 👑 Premium Profile Hero Banner Section */}
          <section className="premium-card overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border border-emerald-500/20 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-[260px] h-[260px] bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute inset-0 grid-pattern-overlay opacity-10 pointer-events-none" />
            
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px] lg:items-center relative z-10 animate-fade-up">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                {/* Large Initial Avatar with gradient ring */}
                <div className="grid h-24 w-24 place-items-center rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-slate-900 to-slate-950 text-4xl font-black text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.2)] hover:scale-105 transition-transform duration-300 select-none">
                  {(profile.username || "U")[0].toUpperCase()}
                </div>
                <div>
                  <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300 shadow-inner select-none mb-2">
                    Rank: Candidate Cockpit Builder
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-heading leading-tight">@{profile.username}</h2>
                  <p className="mt-2 text-xs text-slate-400 font-semibold">Member since {formatDate(profile.joinedAt)}</p>
                </div>
              </div>
              
              {/* Badge Showcase Stats */}
              <div className="rounded-2xl border border-white/5 bg-slate-950/40 p-5 shadow-inner select-none hover:border-emerald-500/20 transition-all duration-300">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Achievement Showcase</p>
                <div className="flex items-baseline gap-2 mt-2">
                  <p className="text-3xl font-black text-white font-heading">{profile.achievements.length}</p>
                  <span className="text-xs font-bold text-slate-500">Milestones Unlocked</span>
                </div>
                <p className="mt-1 text-xs text-emerald-400 font-bold">Showcasing prep badges to recruiters</p>
              </div>
            </div>
          </section>

          {!hasInterviews && (
            <EmptyState title="No public interview performance yet" description="Completed interviews and scorecards will appear here as aggregated stats." icon={User} />
          )}

          {/* 4-Column Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Interviews" value={profile.totalInterviews} caption="Completed interviews" icon={BarChart3} />
            <StatCard label="Average Score" value={`${profile.averageScore}%`} caption="Across scorecards" icon={Target} />
            <StatCard label="Best Score" value={`${profile.bestScore}%`} caption="Highest scorecard" icon={Trophy} />
            <StatCard label="Coding Interviews" value={profile.codingInterviews} caption="Coding mock rounds" icon={Code2} />
          </div>

          {/* Core Skill Progress Meters */}
          <div className="grid gap-4 md:grid-cols-3">
            <SkillMeter label="Technical Accuracy" value={profile.technicalAverage} icon={Target} />
            <SkillMeter label="Communication Fluency" value={profile.communicationAverage} icon={MessageSquare} />
            <SkillMeter label="Problem Solving Speed" value={profile.problemSolvingAverage} icon={Medal} />
          </div>

          {/* Platform Coding Progress Section */}
          <section className="premium-card overflow-hidden">
            <div className="border-b border-white/5 p-5 bg-slate-900/40">
              <h2 className="text-base font-black text-white font-heading tracking-tight">Coding Performance</h2>
              <p className="mt-1 text-xs text-slate-400">Problem solving stats from the platform</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5">
              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-4 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Problems Solved</p>
                <p className="mt-2 text-2xl font-black text-white font-heading">{profile.problemsSolved}</p>
                <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">Accepted solves</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-4 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Acceptance Rate</p>
                <p className="mt-2 text-2xl font-black text-emerald-400 font-heading">{profile.acceptanceRate}%</p>
                <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">Of total runs</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-4 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Coding Interviews</p>
                <p className="mt-2 text-2xl font-black text-white font-heading">{profile.codingInterviews}</p>
                <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">Sandbox sessions</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-slate-950/20 p-4 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Achievements</p>
                <p className="mt-2 text-2xl font-black text-amber-400 font-heading">{profile.achievements.length}</p>
                <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">Badges earned</p>
              </div>
            </div>
          </section>

          {/* Activity Heatmap with prominent card wrappers */}
          <section className="premium-card p-5 sm:p-6 overflow-hidden">
            <ActivityHeatmap activity={heatmapActivity} title="Mock Session Activity Heatmap" subtitle="Public scorecard logs tracked over the last 365 days" />
          </section>

          <ProgressChart data={profile.recentProgress} />

          {/* Achievements & Timeline Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            {/* Unlocked Badges */}
            <section className="premium-card p-5 sm:p-6 flex flex-col">
              <h2 className="text-base font-black text-white font-heading tracking-tight shrink-0">Unlocked Badges</h2>
              <p className="mt-1 text-xs text-slate-400 mb-5 shrink-0">Unlocked badge-style milestones and certificates</p>
              <div className="grid gap-3.5 sm:grid-cols-2 max-h-[360px] overflow-y-auto premium-scrollbar pr-1 flex-1 content-start">
                {profile.achievements.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No achievements unlocked yet.</p>
                ) : (
                  profile.achievements.map((achievement) => (
                    <div key={achievement.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4.5 shadow-md flex items-start gap-3 hover:-translate-y-0.5 transition-transform duration-200">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 shadow-lg shrink-0 mt-0.5">
                        <Award size={18} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-white text-xs sm:text-sm leading-snug">{achievement.name}</h3>
                        <p className="mt-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{formatDate(achievement.unlockedAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Strengths Dashboard Summary */}
            <section className="premium-card p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-black text-white font-heading tracking-tight">Top Strengths</h2>
                <p className="mt-1 text-xs text-slate-400 mb-5">Most frequent strengths from mock rounds</p>
                <div className="flex flex-wrap gap-2.5">
                  {profile.topStrengths.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No strengths recorded yet.</p>
                  ) : (
                    profile.topStrengths.map((strength) => (
                      <span key={strength.label} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-bold text-emerald-300 flex items-center gap-1.5 capitalize hover:border-emerald-500/40 transition-colors">
                        <Check size={12} className="text-emerald-400 shrink-0" />
                        <span>{strength.label} ({strength.count})</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4.5 mt-6 shadow-inner text-xs font-semibold text-slate-400 leading-relaxed select-none">
                <span className="font-extrabold text-white block mb-1">Career Copilot Profile</span>
                Aggregate data on communication, problem solving, and technical accuracy is compiled in real-time. Share this profile link with recruiters to showcase mock benchmarks.
              </div>
            </section>
          </div>

          {/* Recent Activity Timeline */}
          <section className="premium-card p-5 sm:p-6 mt-6">
            <h2 className="text-base font-black text-white font-heading tracking-tight">Recent Activity Timeline</h2>
            <p className="mt-1 text-xs text-slate-400 mb-5">Timeline of mock sessions and evaluations completed</p>
            
            <div className="space-y-4 relative border-l border-white/5 pl-4 ml-2.5">
              {profile.recentProgress.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No recent activity recorded.</p>
              ) : (
                profile.recentProgress.slice(0, 5).map((item, index) => (
                  <div key={index} className="relative group">
                    {/* Timeline dot */}
                    <span className="absolute -left-6.5 top-1.5 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-[0_0_8px_rgba(52,211,153,0.35)] group-hover:scale-110 transition-transform duration-200" />
                    
                    <div className="bg-slate-950/20 border border-white/5 rounded-2xl p-4 transition-all duration-300 hover:bg-slate-950/40">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            {item.templateType || "Mock Session"}
                          </span>
                          <h4 className="mt-2 text-xs font-bold text-white">Interview Score: {item.overallScore}%</h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-semibold">Overall result was locked and logged to repository cockpit.</p>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{formatDate(item.date || item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </AppShell>
  );
}

export default PublicProfile;
