/**
 * @file Dashboard.jsx
 * @description Main dashboard page for ALGOPILOT. Aggregates and displays
 * metrics, streaks, topic mastery, and quick action navigations.
 */

import React, { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { useSelector } from "react-redux";
import {
  Award,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Flame,
  Gauge,
  LineChart,
  Target,
  Trophy,
  Code2,
  BookOpen,
  User,
  ArrowRight,
  Sparkles
} from "lucide-react";
import axiosClient from "../utils/axiosClient";
import AppShell from "../components/layout/AppShell";
import ActivityHeatmap from "../components/ui/ActivityHeatmap";

/**
 * Normalizes user email prefix or name to build a clean profile username.
 * @param {Object} user - User details from Redux state
 * @returns {string} Clean, URL-safe username slug
 */
const getProfileUsername = (user) => {
  const emailPrefix = user?.emailId?.split("@")?.[0];
  const nameFallback = [user?.firstName, user?.lastName].filter(Boolean).join("-");
  return String(emailPrefix || nameFallback || "me")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
};

const formatPercent = (value) => `${Math.round(value || 0)}%`;

const TAG_LABELS = {
  array: "Array",
  string: "String",
  hashTable: "Hash Table",
  linkedList: "Linked List",
  tree: "Tree / Binary Tree",
  binarySearch: "Binary Search",
  twoPointers: "Two Pointers",
  sorting: "Sorting",
  stack: "Stack",
  queue: "Queue",
  heap: "Heap (Priority Queue)",
  greedy: "Greedy",
  recursion: "Recursion",
  backtracking: "Backtracking",
  bitManipulation: "Bit Manipulation",
  bfs: "Breadth-First Search (BFS)",
  dfs: "Depth-First Search (DFS)",
  graph: "Graph",
  dp: "Dynamic Programming (DP)",
  slidingWindow: "Sliding Window",
  math: "Math",
  matrix: "Matrix"
};

/**
 * AnimatedCounter Component
 * Animates a numeric value from 0 up to a target number using requestAnimationFrame.
 */
function AnimatedCounter({ value, duration = 800 }) {
  const [current, setCurrent] = useState(0);
  
  // Parse digits for the count-up animation
  const numericValue = useMemo(() => {
    const parsed = parseInt(String(value).replace(/[^0-9]/g, ""), 10);
    return isNaN(parsed) ? 0 : parsed;
  }, [value]);
  
  // Isolate any text suffixes (like %, +, etc.)
  const suffix = useMemo(() => {
    return String(value).replace(/[0-9]/g, "");
  }, [value]);

  useEffect(() => {
    if (numericValue === 0) {
      setCurrent(0);
      return;
    }
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const val = Math.round(progress * numericValue);
      setCurrent(val);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [numericValue, duration]);

  return <span>{current}{suffix}</span>;
}

/**
 * MetricCard Component
 * Displays a premium styled card representing a single analytics metric.
 */
function MetricCard({ label, value, caption, icon: Icon, tone = "emerald" }) {
  const tones = {
    emerald: "from-emerald-950/30 to-emerald-900/5 text-emerald-300 border-emerald-500/20 border-l-4 border-l-emerald-400 shadow-xl shadow-emerald-950/20",
    blue: "from-blue-950/30 to-blue-900/5 text-blue-300 border-blue-500/20 border-l-4 border-l-blue-400 shadow-xl shadow-blue-950/20",
    amber: "from-amber-950/30 to-amber-900/5 text-amber-300 border-amber-500/20 border-l-4 border-l-amber-400 shadow-xl shadow-amber-950/20",
    violet: "from-violet-950/30 to-violet-900/5 text-violet-300 border-violet-500/20 border-l-4 border-l-violet-400 shadow-xl shadow-violet-950/20"
  };

  return (
    <article className={`premium-card overflow-hidden border bg-gradient-to-br p-5 flex flex-col justify-between relative ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white font-heading">
            {/* Counts up from zero on render */}
            <AnimatedCounter value={value} />
          </p>
          <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{caption}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/5 bg-white/5 text-slate-300 shrink-0 shadow-inner">
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function ProgressBar({ label, value, color = "bg-emerald-400" }) {
  const width = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-200">
        <span>{label}</span>
        <span>{Math.round(width)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * ReadinessRing Component
 * Displays a radial SVG gauge representing the user's readiness score.
 */
function ReadinessRing({ score }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate the dial gauge rotation on score updates
  useEffect(() => {
    const duration = 1000; // ms
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(progress * score);
      setAnimatedScore(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  return (
    <div className="relative grid h-40 w-40 place-items-center rounded-full transition-transform duration-300 hover:scale-105" style={{ background: `conic-gradient(#34d399 ${animatedScore}%, rgba(255,255,255,0.06) 0)` }}>
      <div className="grid h-32 w-32 place-items-center rounded-full bg-slate-950 shadow-2xl border border-white/5">
        <div className="text-center select-none">
          <p className="text-4xl font-black text-white font-heading tracking-tight">{animatedScore}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">Readiness</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard Component
 * Renders user's core dashboard displaying learning roadmaps, recent solved history,
 * streaks, and interview mock performance analytics.
 */
function Dashboard() {
  const { user } = useSelector((state) => state.auth);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [attemptedProblems, setAttemptedProblems] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [achievements, setAchievements] = useState({ currentStreak: 0, longestStreak: 0, achievements: [] });
  const [loading, setLoading] = useState(true);

  // Dynamic router path to public profile
  const profilePath = `/profile/${getProfileUsername(user)}`;

  // Fetch all dashboard requirements in parallel once user context is ready
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [solvedRes, attemptedRes, analyticsRes, achievementsRes] = await Promise.allSettled([
          axiosClient.get("/problem/problemSolvedByUser"),
          axiosClient.get("/problem/attemptedProblem"),
          axiosClient.get("/api/interview/analytics"),
          axiosClient.get("/api/interview/achievements")
        ]);

        // Gracefully handle partial load failures
        setSolvedProblems(solvedRes.status === "fulfilled" ? solvedRes.value.data?.problemSolved || [] : []);
        setAttemptedProblems(attemptedRes.status === "fulfilled" ? attemptedRes.value.data || [] : []);
        setAnalytics(analyticsRes.status === "fulfilled" ? analyticsRes.value.data || {} : {});
        setAchievements(achievementsRes.status === "fulfilled" ? achievementsRes.value.data || {} : {});
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchData();
  }, [user]);

  const totalSolved = solvedProblems.length;
  const totalAttempted = totalSolved + attemptedProblems.length;
  const acceptanceRate = totalAttempted > 0 ? Math.min(100, (totalSolved / totalAttempted) * 100) : 0;
  const unlockedAchievements = (achievements.achievements || []).filter((item) => item.unlocked).length;

  const difficultyBreakdown = useMemo(() => {
    let easy = 0, medium = 0, hard = 0;
    solvedProblems.forEach((p) => {
      const diff = String(p.difficulty || "").toLowerCase();
      if (diff.includes("easy")) easy++;
      else if (diff.includes("hard")) hard++;
      else medium++;
    });
    return { easy, medium, hard };
  }, [solvedProblems]);

  const topicMastery = useMemo(() => {
    const counts = solvedProblems.reduce((acc, problem) => {
      const tags = Array.isArray(problem.tags) ? problem.tags : [problem.tags || problem.difficulty || "Practice"];
      tags.filter(Boolean).forEach((tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label: TAG_LABELS[label] || label, count, percent: Math.min(100, Math.round((count / Math.max(totalSolved, 1)) * 100)) }));
  }, [solvedProblems, totalSolved]);

  // Activity Date Bug Fix: Only include items with real timestamps, no index fallback
  const activity = useMemo(() => {
    const solvedActivity = (analytics.codingActivity || [])
      .filter((item) => item.date || item.createdAt)
      .map((item) => ({
        date: item.date || item.createdAt,
        count: 1
      }));

    const interviewActivity = (analytics.scoreTrend || [])
      .filter((item) => item.date || item.createdAt)
      .map((item) => ({
        date: item.date || item.createdAt,
        count: 1
      }));

    return [...solvedActivity, ...interviewActivity];
  }, [solvedProblems, analytics.scoreTrend]);

  // Colored dots helper for activity timeline
  const timeline = useMemo(() => {
    const problemItems = solvedProblems.slice(-4).reverse().map((problem) => ({
      label: `Solved ${problem.title}`,
      meta: problem.difficulty || "Coding",
      icon: CheckCircle2,
      type: "solved"
    }));
    const interviewItems = (analytics.reportHistory || []).slice(0, 3).map((report) => ({
      label: `Interview score ${report.overallScore || 0}`,
      meta: report.hireRecommendation || "Scorecard",
      icon: BrainCircuit,
      type: "interview"
    }));
    return [...interviewItems, ...problemItems].slice(0, 6);
  }, [solvedProblems, analytics.reportHistory]);

  const getTimelineDot = (type) => {
    if (type === "solved") return "bg-emerald-400 shadow-[0_0_8px_#34d399]";
    if (type === "interview") return "bg-blue-400 shadow-[0_0_8px_#60a5fa]";
    return "bg-amber-400 shadow-[0_0_8px_#fbbf24]";
  };

  const quickActions = [
    {
      to: "/problems",
      title: "Solve a Problem",
      description: "Hone your data structures & algorithms against direct sandbox test suits.",
      icon: Code2,
      color: "text-emerald-400 group-hover:text-emerald-300"
    },
    {
      to: "/interview/start",
      title: "Start Interview",
      description: "Engage in live voice/chat mock runs customized to target JD requirements.",
      icon: BrainCircuit,
      color: "text-cyan-400 group-hover:text-cyan-300"
    },
    {
      to: "/interview/analytics",
      title: "View Analytics",
      description: "Inspect performance trends, hire quotients, and scorecard history logs.",
      icon: BarChart3,
      color: "text-blue-400 group-hover:text-blue-300"
    },
    {
      to: "/interview/roadmap",
      title: "Learning Roadmap",
      description: "Follow structural practice roadmaps matching your skill gaps dynamically.",
      icon: BookOpen,
      color: "text-violet-400 group-hover:text-violet-300"
    },
    {
      to: "/interview/achievements",
      title: "Achievements",
      description: "Review unlocked milestones, consistency rewards, and active daily streaks.",
      icon: Award,
      color: "text-amber-400 group-hover:text-amber-300"
    },
    {
      to: profilePath,
      title: "My Public Profile",
      description: "Share progress logs, completed metrics, and unlock badges with recruiters.",
      icon: User,
      color: "text-rose-400 group-hover:text-rose-300"
    }
  ];

  if (loading) {
    return (
      <AppShell title="Dashboard" subtitle="Loading your ALGOPILOT cockpit.">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="premium-card h-36 animate-pulse" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="" subtitle="" actions={null}>
      {/* 👑 Premium Hero Banner Section */}
      <div className="algopilot-hero mb-6 p-6 sm:p-8 animate-fade-up">
        {/* Glow overlay */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-[200px] h-[200px] bg-cyan-500/5 blur-[60px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 grid-pattern-overlay opacity-10 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-1 text-xs font-extrabold text-emerald-300 mb-3 shadow-inner">
              <Sparkles size={12} className="animate-pulse" />
              <span>COMMAND CENTER ONLINE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white font-heading tracking-tight leading-tight">
              Welcome back, <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{user?.firstName || "coder"}</span>!
            </h1>
            <p className="mt-3 text-sm text-slate-400 max-w-xl font-semibold leading-relaxed">
              Your personal career cockpit is fully synchronized. Solve algorithms, take custom mock interviews matching your target JDs, and level up your software engineering credentials.
            </p>
            <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="glass-stat p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Solved</p>
                <p className="mt-1 text-2xl font-black text-white font-heading"><AnimatedCounter value={totalSolved} /></p>
              </div>
              <div className="glass-stat p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Readiness</p>
                <p className="mt-1 text-2xl font-black text-emerald-300 font-heading"><AnimatedCounter value={analytics.averageOverallScore || 0} /></p>
              </div>
              <div className="glass-stat p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Achievements</p>
                <p className="mt-1 text-2xl font-black text-amber-300 font-heading"><AnimatedCounter value={unlockedAchievements} /></p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <NavLink to="/problems" className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.15)] font-black uppercase">
                Solve Problems
              </NavLink>
              <NavLink to="/interview/start" className="premium-muted-button text-xs py-2 px-4 font-black uppercase">
                Start Mock Interview
              </NavLink>
            </div>
          </div>

          {/* Quick Streak Widget */}
          <div className="flex items-center gap-4 bg-slate-950/50 border border-white/5 rounded-2xl p-5 shadow-inner min-w-[220px] backdrop-blur-sm hover:border-emerald-500/20 transition-all duration-300">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 shadow-md">
              <Flame size={24} className="animate-bounce" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Practice Streak</p>
              <p className="text-2xl font-black text-white font-heading mt-0.5">{achievements.currentStreak || 0} Days</p>
              <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Daily consistency compounds.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Grid: sm:grid-cols-2 xl:grid-cols-3 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Problems Solved" value={totalSolved} caption="Accepted coding tasks in workspace" icon={Code2} tone="emerald" />
        <MetricCard label="Acceptance Rate" value={formatPercent(acceptanceRate)} caption={`${totalAttempted} unique tasks attempted`} icon={Gauge} tone="blue" />
        <MetricCard label="Current Streak" value={`${achievements.currentStreak || 0}d`} caption="Consecutive practice days run" icon={Flame} tone="amber" />
        <MetricCard label="Longest Streak" value={`${achievements.longestStreak || 0}d`} caption="Best practice consistency streak" icon={Trophy} tone="violet" />
        <MetricCard label="Mock Interviews" value={analytics.totalInterviews || 0} caption="Completed voice/chat rounds" icon={BrainCircuit} tone="emerald" />
        <MetricCard label="Average Performance" value={analytics.averageOverallScore || 0} caption="Overall score average across rounds" icon={BarChart3} tone="blue" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.75fr]">
        <ActivityHeatmap activity={activity} />

        <section className="premium-card p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-black text-white font-heading tracking-tight">Recent Activity</h2>
              <p className="mt-1 text-xs text-slate-400">Latest coding and interview sessions</p>
            </div>
            <LineChart className="text-emerald-400 animate-glow-pulse" size={18} />
          </div>
          
          <div className="mt-5 space-y-3.5 flex-1 overflow-y-auto premium-scrollbar max-h-[300px]">
            {timeline.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/8 p-5 text-xs text-slate-500 text-center my-auto">
                No session logs recorded yet. Start mock practice to build history.
              </div>
            ) : (
              timeline.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-950/20 p-3.5 hover:bg-slate-950/40 transition-colors duration-200 shadow-inner">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Colored prefix dot based on type */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getTimelineDot(item.type)}`} />
                      
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 border border-white/5 text-slate-300">
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-white leading-tight">{item.label}</p>
                        <p className="text-[10px] text-slate-500 font-extrabold tracking-wider mt-1 uppercase">{item.meta}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Topic Mastery & Coding Progress Breakdown */}
        <section className="premium-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-white font-heading tracking-tight">Coding Progress</h2>
            <p className="mt-1 text-xs text-slate-400 mb-5">Submissions solved vs attempted difficulty</p>
            
            {/* Coding stats difficulty progress breakdown */}
            <div className="space-y-3 mb-6 bg-slate-950/40 p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-emerald-400">Easy</span>
                <span className="text-slate-300 font-bold">{difficultyBreakdown.easy} Solved</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, (difficultyBreakdown.easy / Math.max(1, totalSolved)) * 100)}%` }} />
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1.5">
                <span className="text-amber-400">Medium</span>
                <span className="text-slate-300 font-bold">{difficultyBreakdown.medium} Solved</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, (difficultyBreakdown.medium / Math.max(1, totalSolved)) * 100)}%` }} />
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1.5">
                <span className="text-red-400">Hard</span>
                <span className="text-slate-300 font-bold">{difficultyBreakdown.hard} Solved</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, (difficultyBreakdown.hard / Math.max(1, totalSolved)) * 100)}%` }} />
              </div>
            </div>

            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">Topic Mastery</h3>
            <div className="space-y-3">
              {topicMastery.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Complete algorithm problems to map tag mastery.</p>
              ) : (
                topicMastery.slice(0, 3).map((topic, index) => (
                  <ProgressBar
                    key={topic.label}
                    label={topic.label}
                    value={topic.percent}
                    color={["bg-emerald-400", "bg-cyan-400", "bg-blue-400"][index % 3]}
                  />
                ))
              )}
            </div>
          </div>
        </section>

        {/* Interview Readiness Conic animated Ring */}
        <section className="premium-card p-5 sm:p-6 flex flex-col justify-between items-center text-center">
          <div className="self-start text-left">
            <h2 className="text-base font-black text-white font-heading tracking-tight">Mock Interview Readiness</h2>
            <p className="mt-1 text-xs text-slate-400">Real-time mock analytics profile score</p>
          </div>
          
          <div className="my-6">
            <ReadinessRing score={analytics.averageOverallScore || 0} />
          </div>

          <NavLink to="/interview/analytics" className="ghost-button w-full text-xs font-bold py-2.5">
            Open Analytics
          </NavLink>
        </section>

        {/* Weekly Goals & Milestones Progress */}
        <section className="premium-card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-white font-heading tracking-tight">Weekly Objectives</h2>
            <p className="mt-1 text-xs text-slate-400 mb-5">Target milestones to unlock credentials</p>
            
            {/* Goals progress */}
            {(() => {
              // 1. Calculate Rolling 7-Day Window Activity
              const oneWeekAgo = new Date();
              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
              
              const solvesThisWeek = (analytics.codingActivity || []).filter(item => {
                const d = new Date(item.date || item.createdAt);
                return d >= oneWeekAgo;
              }).length;
              
              const interviewsThisWeek = (analytics.scoreTrend || []).filter(item => {
                const d = new Date(item.date || item.createdAt);
                return d >= oneWeekAgo;
              }).length;

              const activeDaysThisWeek = new Set([
                ...(analytics.codingActivity || []),
                ...(analytics.scoreTrend || [])
              ].map(item => new Date(item.date || item.createdAt).toDateString())
               .filter(dStr => new Date(dStr) >= oneWeekAgo)
              ).size;

              // 2. Dynamic Scaling Gamification Logic
              const targetSolves = totalSolved > 50 ? 7 : (totalSolved > 20 ? 5 : 3);
              const targetMocks = (analytics.totalInterviews || 0) > 10 ? 2 : 1;
              const targetDays = 3;
              const targetStreak = (achievements.longestStreak || 0) > 5 ? 3 : 2;

              const currentStreak = achievements.currentStreak || 0;

              const goals = [
                { id: 1, label: `Solve ${targetSolves} tasks this week (${Math.min(solvesThisWeek, targetSolves)}/${targetSolves})`, completed: solvesThisWeek >= targetSolves },
                { id: 2, label: `Complete ${targetMocks} mock interview (${Math.min(interviewsThisWeek, targetMocks)}/${targetMocks})`, completed: interviewsThisWeek >= targetMocks },
                { id: 3, label: `Practice on ${targetDays} different days (${Math.min(activeDaysThisWeek, targetDays)}/${targetDays})`, completed: activeDaysThisWeek >= targetDays },
                { id: 4, label: `Maintain a ${targetStreak}-day streak (${Math.min(currentStreak, targetStreak)}/${targetStreak})`, completed: currentStreak >= targetStreak }
              ];
              const completedCount = goals.filter(g => g.completed).length;
              const goalPercent = Math.round((completedCount / goals.length) * 100);

              return (
                <>
                  <div className="bg-slate-950/40 p-4 rounded-2xl border border-white/5 mb-5 shadow-inner">
                    <div className="flex justify-between items-center text-xs font-black text-slate-300 uppercase mb-2">
                      <span>Goal Progress</span>
                      <span className="text-emerald-400">{completedCount} / {goals.length} Done</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${goalPercent}%` }} />
                    </div>
                  </div>

                  <ul className="space-y-3.5 text-xs text-slate-300 font-semibold select-none text-left">
                    {goals.map(g => (
                      <li key={g.id} className="flex items-center gap-3">
                        <div className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                          g.completed 
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" 
                            : "border-white/10 bg-slate-950/40 text-slate-600"
                        }`}>
                          {g.completed ? (
                            <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          )}
                        </div>
                        <span className={g.completed ? "line-through text-slate-500" : "text-slate-300"}>{g.label}</span>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
          
          <NavLink to="/interview/achievements" className="premium-button w-full text-xs font-black uppercase tracking-wider mt-6 py-2.5">
            Open Achievements
          </NavLink>
        </section>
      </div>

      {/* QUICK ACTIONS GRID (6 cells) */}
      <section className="premium-card mt-6 p-5 sm:p-6 overflow-hidden">
        <div className="border-b border-white/5 pb-4 mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-white font-heading tracking-tight flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-400" />
              <span>Mission Control</span>
            </h2>
            <p className="mt-1 text-xs text-slate-400">Fast paths into the highest-value ALGOPILOT workflows</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <NavLink
                key={i}
                to={action.to}
                className="group rounded-2xl border border-white/8 bg-white/[0.02] p-4.5 transition-all duration-300 hover:bg-slate-900 hover:border-emerald-500/20 hover:-translate-y-0.5 shadow-md flex flex-col justify-between min-h-[136px]"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`grid h-9 w-9 place-items-center rounded-xl bg-slate-950 border border-white/5 ${action.color}`}>
                      <Icon size={16} />
                    </div>
                    <ArrowRight size={13} className="text-slate-600 transition-all duration-300 group-hover:text-emerald-400 group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-3.5 text-xs font-black text-white uppercase tracking-wider font-heading leading-tight">{action.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400 font-semibold">{action.description}</p>
                </div>
              </NavLink>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

export default Dashboard;


