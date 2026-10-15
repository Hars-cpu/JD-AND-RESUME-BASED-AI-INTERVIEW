/**
 * @file AchievementsPage.jsx
 * @summary Achievements and Practice Streaks workspace. Fetches placement trophies, active streak logs, 
 *          and overall milestones from the backend. Renders progress metrics using dynamic SVG progress rings, 
 *          summary cards, and streak visualizers.
 * 
 * @functions
 * - formatDate: Formats numeric unlock timestamps into readable local calendar date strings.
 * - SVGProgressRing: Renders a circle ring visualizer mapping target achievements progress.
 * - SummaryCard: Renders stats summaries (like streaks, trophy counts) inside styled dashboard cards.
 * - AchievementCard: Renders detailed badge panels containing state markers (locked/unlocked) and progress bars.
 * - AchievementsPage: Main functional page component that loads candidate achievement stats from `/api/interview/achievements`, 
 *                     groups them into milestones vs streaks, and coordinates animations.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Flame, Lock, Medal, Sparkles, Trophy, ChevronRight, Zap } from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import AppShell from "../../components/layout/AppShell";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/interview/FeedbackUI";

const emptyAchievements = { currentStreak: 0, longestStreak: 0, achievements: [] };

const badgeIcons = {
  "first-interview": Award,
  "interview-explorer": Medal,
  "interview-master": Trophy,
  "strong-hire": Sparkles,
  "coding-enthusiast": Award,
  "interview-marathon": Trophy,
  "perfect-score": Medal,
  "seven-day-streak": Flame,
  "thirty-day-streak": Flame
};

const formatDate = (date) => {
  if (!date) return "Not unlocked yet";
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

function SVGProgressRing({ percentage, unlocked }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg className="w-14 h-14 transform -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="3.5"
          fill="transparent"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke={unlocked ? "#34d399" : "rgba(255, 255, 255, 0.15)"}
          strokeWidth="3.5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-black text-white">{percentage}%</span>
    </div>
  );
}

function SummaryCard({ label, value, caption, icon: Icon, color = "amber" }) {
  const tones = {
    amber: "border-amber-400/20 bg-amber-400/5 text-amber-300",
    emerald: "border-emerald-400/20 bg-emerald-400/5 text-emerald-300",
    violet: "border-violet-400/20 bg-violet-400/5 text-violet-300"
  };

  return (
    <article className={`premium-card p-5 border ${tones[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-white font-heading tracking-tight">{value}</p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{caption}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/5 bg-white/5 text-slate-300 shadow-inner">
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function AchievementCard({ achievement, index }) {
  const Icon = badgeIcons[achievement.id] || Award;
  const progress = Number(achievement.progress) || 0;
  const target = Number(achievement.target) || 1;
  const percentage = target > 0 ? Math.round((Math.min(progress, target) / target) * 100) : 0;
  const unlocked = Boolean(achievement.unlocked);

  return (
    <article
      style={{ animationDelay: `${index * 80}ms` }}
      className={`premium-card group overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 relative opacity-0 animate-unlock-badge ${
        unlocked 
          ? "border-emerald-500/20 bg-slate-900/80 shadow-[0_0_20px_rgba(52,211,153,0.04)]" 
          : "border-white/5 bg-slate-900/30 opacity-60"
      }`}
    >
      {/* Top right lock indicator */}
      <div className="absolute top-4 right-4 z-10">
        {unlocked ? (
          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
            <CheckCircle2 size={13} />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-lg bg-slate-950 border border-white/10 text-slate-500 flex items-center justify-center">
            <Lock size={12} />
          </div>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        {/* Glowing Badge Circle */}
        <div className={`grid h-14 w-14 place-items-center rounded-2xl border transition-all duration-300 ${
          unlocked 
            ? "border-amber-400/20 bg-amber-400/10 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.15)] group-hover:scale-105" 
            : "border-white/5 bg-slate-950 text-slate-500"
        }`}>
          <Icon size={24} className={unlocked ? "animate-glow-pulse" : ""} />
        </div>
        
        {/* SVG Progress Ring */}
        <SVGProgressRing percentage={percentage} unlocked={unlocked} />
      </div>

      <div className="mt-5">
        <h3 className="text-base font-black text-white font-heading leading-tight flex items-center gap-1.5">
          {achievement.name}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-400 font-semibold min-h-[40px] group-hover:text-slate-300 transition-colors">
          {achievement.description}
        </p>
      </div>

      {/* Progress metrics footer */}
      <div className={`mt-5 rounded-2xl border p-4 shadow-inner ${
        unlocked 
          ? "border-emerald-500/10 bg-emerald-500/5 text-slate-200" 
          : "border-white/5 bg-slate-950/40"
      }`}>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
          {unlocked ? "Unlocked At" : "Target Progress"}
        </p>
        <p className="mt-1.5 text-xs font-black text-white flex items-center justify-between">
          <span>{unlocked ? formatDate(achievement.unlockedAt) : `${progress} / ${target}`}</span>
          {!unlocked && <span className="text-[10px] text-slate-500 font-bold">Incomplete</span>}
        </p>
      </div>
    </article>
  );
}

function AchievementsPage() {
  const [data, setData] = useState(emptyAchievements);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const response = await axiosClient.get("/api/interview/achievements");
        setData({ ...emptyAchievements, ...response.data });
      } catch (loadError) {
        setError(loadError.response?.data?.error || "Failed to load achievements");
      } finally {
        setLoading(false);
      }
    };
    loadAchievements();
  }, []);

  const unlockedCount = useMemo(() => data.achievements.filter((achievement) => achievement.unlocked).length, [data.achievements]);
  
  const progressPercent = useMemo(() => {
    const total = data.achievements.length;
    return total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
  }, [unlockedCount, data.achievements]);

  const grouped = useMemo(() => ({
    "Interview Milestones": data.achievements.filter((achievement) => !achievement.id?.includes("streak")),
    "Practice Streaks": data.achievements.filter((achievement) => achievement.id?.includes("streak"))
  }), [data.achievements]);

  if (loading) return <LoadingSkeleton title="Loading Achievements" rows={3} />;

  return (
    <AppShell title="Achievements Workspace" subtitle="Complete mock platform trophies, practice streak rewards, and unlock metrics.">
      {error && <ErrorState title="Achievements unavailable" message={error} onRetry={() => window.location.reload()} />}

      {!error && (
        <div className="space-y-6">
          {/* Summary Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Current Active Streak" value={`${data.currentStreak} Days`} caption="Consecutive practice days run" icon={Flame} color="amber" />
            <SummaryCard label="Longest Practice Run" value={`${data.longestStreak} Days`} caption="Personal best consistency run" icon={Trophy} color="violet" />
            <SummaryCard label="Total Unlocked Badges" value={`${unlockedCount} / ${data.achievements.length}`} caption={`Placement trophies unlocked`} icon={Award} color="emerald" />
          </div>

          {/* Interactive Streak Details & Fire Emojis bar */}
          {data.currentStreak > 0 && (
            <div className="premium-card p-5 bg-gradient-to-br from-amber-950/20 to-orange-950/10 border-amber-500/20 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 shadow-md">
                  <Flame size={20} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider font-heading leading-tight">Daily Streak Active</h3>
                  <p className="text-xs text-slate-400 mt-1 font-semibold">You have logged in and prepared consecutively for {data.currentStreak} days!</p>
                </div>
              </div>
              
              {/* Fire Emoji row mapping streak days */}
              <div className="flex flex-wrap gap-1 bg-slate-950/50 p-2.5 rounded-xl border border-white/5">
                {Array.from({ length: Math.min(10, data.currentStreak) }).map((_, i) => (
                  <Flame key={i} size={15} className="text-orange-400 animate-pulse drop-shadow-[0_0_4px_#f97316]" />
                ))}
                {data.currentStreak > 10 && (
                  <span className="text-[10px] text-orange-400 font-extrabold flex items-center pl-1.5">
                    +{data.currentStreak - 10} More
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Summary Progress Bar */}
          <div className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-3 select-none">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-emerald-400" />
                <span>Overall Completion Progress</span>
              </div>
              <span>{progressPercent}% Unlocked</span>
            </div>
            <div className="h-3 rounded-full bg-slate-950 border border-white/5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-3">
              {progressPercent === 100 
                ? "Incredible! You have unlocked all placement-ready milestones. Keep pushing!" 
                : "Challenge yourself with mock interviews, high score targets, and active daily streaks to unlock remaining badges!"
              }
            </p>
          </div>

          {/* Badge grid sections */}
          {data.achievements.length === 0 ? (
            <EmptyState title="No achievements available yet" description="Complete mock interviews and challenges to unlock trophies." icon={Award} />
          ) : (
            Object.entries(grouped).map(([group, achievements]) => (
              achievements.length > 0 && (
                <section key={group} className="space-y-4">
                  <div className="border-b border-white/5 pb-2.5">
                    <h2 className="text-lg font-black text-white font-heading tracking-tight flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      <span>{group}</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {group === "Practice Streaks" ? "Consistency milestones" : "Mock evaluation and score tier badges"}
                    </p>
                  </div>
                  
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {achievements.map((achievement, idx) => (
                      <AchievementCard key={achievement.id} achievement={achievement} index={idx} />
                    ))}
                  </div>
                </section>
              )
            ))
          )}
        </div>
      )}
    </AppShell>
  );
}

export default AchievementsPage;
