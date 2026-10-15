/**
 * @file CodingInterviewWorkspace.jsx
 * @description Monaco editor-driven coding round workspace for ALGOPILOT.
 * Enables compiling code, running tests, tracking session execution stats,
 * and displaying problem instructions side-by-side with code editors.
 */

import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { NavLink, useParams, useNavigate } from "react-router";
import { 
  ArrowLeft, 
  Code2, 
  Loader2, 
  Play, 
  Send, 
  Clock, 
  Globe, 
  ChevronDown, 
  AlertTriangle, 
  Trophy,
  Lock,
  CheckCircle2,
  Terminal,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Flame
} from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import CodingQuestionCard from "../../components/interview/CodingQuestionCard";
import { ErrorState, LoadingSkeleton, ConfirmationDialog, Toast } from "../../components/interview/FeedbackUI";

// Default code templates by programming language
const starterCode = {
  javascript: "function solve(input) {\n  // Write your solution here\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\nconsole.log(solve(input));\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Write your solution here\n    return 0;\n}\n",
  java: "import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // Write your solution here\n    }\n}\n"
};

const monacoLanguage = {
  javascript: "javascript",
  cpp: "cpp",
  java: "java"
};

/**
 * Formats seconds into MM:SS.
 * @param {number} seconds - Elapsed duration in seconds
 * @returns {string} Formatted duration string
 */
const formatElapsed = (seconds) => {
  const safeSeconds = Math.max(0, seconds);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

/**
 * Calculates total session elapsed duration in seconds.
 * @param {Object} session - Active session parameters
 * @returns {number} Elapsed seconds
 */
const getElapsedSeconds = (session) => {
  if (!session?.startedAt) return 0;
  const endTime = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const startTime = new Date(session.startedAt).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 1000));
};

/**
 * Resolves question counts limits by interview template style.
 * @param {string} templateType - Interview layout format identifier
 * @returns {number} Limit
 */
const getTargetQuestionCount = (templateType) => {
  if (templateType === "coding") return 5;
  if (templateType === "full-mock") return 20;
  return 10;
};

/**
 * Calculates estimated remaining session duration.
 * @param {number} questionCount - Current question progress index
 * @param {number} targetQuestionCount - Target limit goals
 * @returns {string} Estimated duration string
 */
const formatRemainingTime = (questionCount, targetQuestionCount) => {
  const remainingQuestions = Math.max(0, targetQuestionCount - questionCount);
  const remainingMinutes = remainingQuestions * 2;
  if (remainingMinutes <= 0) return "0 min";
  if (remainingMinutes < 60) return `${remainingMinutes} min`;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

/**
 * Normalizes question object structure from server/transcript payloads.
 * @param {Object} entry - Question payload
 * @returns {Object|null} Normalized question details
 */
const normalizeQuestion = (entry) => {
  if (!entry) return null;
  return {
    title: entry.title,
    description: entry.description || entry.message,
    difficulty: entry.difficulty,
    constraints: entry.constraints || [],
    examples: entry.examples || [],
    expectedTopics: entry.expectedTopics || []
  };
};

/**
 * Iterates transcripts backward to extract the latest active coding question.
 * @param {Array} transcript - Dial transcript array list
 * @returns {Object|null} Active question normalized structure
 */
const getLatestCodingQuestion = (transcript = []) => {
  for (let index = transcript.length - 1; index >= 0; index--) {
    if (transcript[index]?.role === "coding-question") {
      return normalizeQuestion(transcript[index]);
    }
  }
  return null;
};

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-white font-heading">{value}</p>
    </div>
  );
}

function ProgressSummary({ elapsed, stats }) {
  return (
    <section className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-0.5 text-[10px] font-black uppercase text-emerald-300 select-none">
            <Clock size={11} />
            <span>Coding Performance</span>
          </div>
          <h2 className="mt-2.5 text-base font-black text-white font-heading leading-tight">
            Question {Math.min(stats.questionCount, stats.targetQuestionCount)} of {stats.targetQuestionCount}
          </h2>
          <p className="mt-1 text-xs text-slate-400 font-semibold">
            Estimated time remaining: <span className="text-emerald-400 font-bold">{stats.estimatedTimeRemaining}</span>
          </p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full lg:max-w-3xl">
          <StatTile label="Elapsed" value={formatElapsed(elapsed)} />
          <StatTile label="Questions" value={stats.questionCount} />
          <StatTile label="Answers" value={stats.answerCount} />
          <StatTile label="Follow-Ups" value={stats.followUpCount} />
          <StatTile label="Complete" value={`${stats.completionPercentage}%`} />
        </div>
      </div>
      
      <div className="mt-5 h-2 rounded-full bg-slate-950 border border-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(52,211,153,0.3)]"
          style={{ width: `${stats.completionPercentage}%` }}
        />
      </div>
    </section>
  );
}

function CodingInterviewWorkspace() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [question, setQuestion] = useState(null);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState(starterCode.javascript);
  const [result, setResult] = useState(null);
  const [loadingAction, setLoadingAction] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Tab controller for responsive viewports below lg
  const [activeTab, setActiveTab] = useState("editor");
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState("testcase");

  const transcript = session?.transcript || [];
  const isCompleted = session?.status === "completed";
  const targetQuestionCount = getTargetQuestionCount(session?.templateType);
  const transcriptQuestionCount = transcript.filter((item) => item.role === "interviewer" || item.role === "coding-question").length;
  const transcriptAnswerCount = transcript.filter((item) => item.role === "candidate" || item.role === "coding-submission").length;
  const transcriptFollowUpCount = transcript.filter((item) => item.role === "interviewer" && item.questionType === "follow-up").length;
  const questionCount = Math.max(Number(session?.questionCount) || 0, transcriptQuestionCount);
  const answerCount = Math.max(Number(session?.answerCount) || 0, transcriptAnswerCount);
  const followUpCount = Math.max(Number(session?.followUpCount) || 0, transcriptFollowUpCount);
  const completionPercentage = targetQuestionCount > 0
    ? Math.min(100, Math.round((questionCount / targetQuestionCount) * 100))
    : 0;

  const hasSubmittedCurrentQuestion = React.useMemo(() => {
    if (!transcript || transcript.length === 0) return false;
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].role === 'coding-question') return false;
      if (transcript[i].role === 'coding-submission') return true;
    }
    return false;
  }, [transcript]);

  const stats = {
    questionCount,
    answerCount,
    followUpCount,
    targetQuestionCount,
    completionPercentage,
    estimatedTimeRemaining: formatRemainingTime(questionCount, targetQuestionCount)
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data } = await axiosClient.get(`/api/interview/session/${sessionId}`);
        setSession(data);
        setElapsed(getElapsedSeconds(data));
        setQuestion(getLatestCodingQuestion(data.transcript));
      } catch (loadError) {
        setError(loadError.response?.data?.error || "Failed to load coding interview session");
      }
    };

    loadSession();
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((current) => {
        if (!session || session.status === "completed") return current;
        return getElapsedSeconds(session);
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [session]);

  const refreshSession = async () => {
    const { data } = await axiosClient.get(`/api/interview/session/${sessionId}`);
    setSession(data);
    setElapsed(getElapsedSeconds(data));
    setQuestion(getLatestCodingQuestion(data.transcript) || question);
  };

  const runAction = async (name, action) => {
    try {
      setError("");
      setLoadingAction(name);
      await action();
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Coding round process failed");
    } finally {
      setLoadingAction("");
    }
  };

  const handleLanguageChange = (nextLanguage) => {
    setLanguage(nextLanguage);
    setCode(starterCode[nextLanguage]);
  };

  const handleGenerateQuestion = () => runAction("question", async () => {
    if (isCompleted) {
      setError("This interview is completed. Coding question generation is disabled.");
      return;
    }
    const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/generate-coding-question`);
    setQuestion(data);
    setResult(null);
    await refreshSession();
  });

  const handleGenerateScorecard = () => runAction("scorecard", async () => {
    if (transcript.length === 0) {
      setError("Generate a problem and compile a solution before ending the interview.");
      return;
    }
    const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/generate-scorecard`);
    setToast({
      title: "Scorecard generated",
      message: "Your final interview assessment is ready. Achievements and streaks have been updated."
    });
    await refreshSession();
  });

  const submitSolution = (actionName) => runAction(actionName, async () => {
    if (isCompleted) {
      setError("This interview is completed. Solution submission is disabled.");
      return;
    }
    if (!question) {
      setError("Generate a coding question before running or submitting code.");
      return;
    }
    if (!code.trim()) {
      setError("Write code before running or submitting.");
      return;
    }
    setConsoleOpen(true);
    if (actionName === "run") {
      setActiveConsoleTab("testcase");
    } else {
      setActiveConsoleTab("result");
    }
    const { data } = await axiosClient.post(`/api/interview/session/${sessionId}/submit-coding-solution`, {
      action: actionName,
      question,
      language,
      code
    });
    setResult(data);
    await refreshSession();
  });

  if (!session && !error) {
    return <LoadingSkeleton title="Loading coding workspace" rows={2} />;
  }

  return (
    <div className="interview-workspace min-h-screen overflow-y-auto flex flex-col font-body relative">
      {/* Absolute grid decoration */}
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay z-0" />

      {/* Top Navbar */}
      <nav className="relative z-40 border-b border-white/8 bg-slate-900/60 backdrop-blur-xl px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <NavLink
            to={`/interview/session/${sessionId}`}
            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10 transition-colors"
            title="Back to voice/chat workspace"
          >
            <ArrowLeft size={16} />
          </NavLink>
          <div>
            <h1 className="text-lg font-black text-white font-heading tracking-tight leading-none">Coding Interview Round</h1>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
              {session?.interviewType || "Practice"} Round &middot; Sandbox compilers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateQuestion}
            disabled={Boolean(loadingAction) || isCompleted}
            className="premium-button text-xs font-black uppercase tracking-wider py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5"
          >
            {loadingAction === "question" ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Code2 size={13} />
                <span>Generate Problem</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => setConfirmEndOpen(true)}
            disabled={Boolean(loadingAction) || isCompleted || transcript.length === 0}
            className="px-4 py-2 rounded-lg text-xs font-bold border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {loadingAction === "scorecard" ? (
              <span className="flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Ending...</span>
            ) : (
              "End Interview"
            )}
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="relative z-10 max-w-[1500px] w-full mx-auto px-4 sm:px-6 py-4 flex-1 min-h-0 flex flex-col">
        {/* Error Notification */}
        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-xs font-semibold text-red-400 flex items-start justify-between gap-3 animate-fade-up">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-extrabold uppercase text-[10px] tracking-wider text-red-400">Sandbox Exception</p>
                <p className="mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
            <button 
              onClick={() => setError("")} 
              className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5 border border-white/5 shrink-0 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Progress Stats Summary */}
        <div className="mb-5">
          <ProgressSummary elapsed={elapsed} stats={stats} />
        </div>

        {/* Completed status banner */}
        {isCompleted && (
          <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed text-emerald-300 flex items-center gap-3 animate-fade-up select-none">
            <Trophy size={18} className="text-emerald-400 animate-glow-pulse shrink-0" />
            <div>
              <p className="font-black text-sm uppercase tracking-wider text-white leading-tight">Coding Round Complete</p>
              <p className="mt-1 font-semibold text-slate-400">Coding challenge has been completed and submissions are officially locked.</p>
            </div>
          </div>
        )}

        {/* Tablet/Mobile Responsive Tab Switches */}
        <div className="flex border border-white/5 bg-slate-900/60 p-1.5 rounded-2xl mb-5 lg:hidden select-none shadow-md">
          {[
            { id: "problem", label: "Algorithm Problem" },
            { id: "editor", label: "Monaco Editor" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all select-none"
              style={{
                background: activeTab === tab.id ? "rgba(52, 211, 153, 0.1)" : "transparent",
                color: activeTab === tab.id ? "#34d399" : "#64748b",
                border: activeTab === tab.id ? "1px solid rgba(52, 211, 153, 0.2)" : "1px solid transparent"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Workspace Layout Grid: Equal 50/50 split on lg+ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-[600px] h-full">
          {/* Question Column */}
          <aside className={`lg:h-full lg:overflow-hidden pb-6 lg:block ${activeTab === "problem" ? "block animate-fade-up" : "hidden"}`}>
            <CodingQuestionCard question={question} />
          </aside>

          {/* Monaco Editor & Evaluation Column */}
          <section className={`lg:h-full lg:flex lg:flex-col pb-6 lg:block ${activeTab === "editor" ? "block animate-fade-up" : "hidden"}`}>
            <div className="premium-card flex-1 min-h-0 bg-[#18181b] border border-white/8 flex flex-col shadow-2xl relative overflow-hidden">
              {isCompleted && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2.5px] z-20 flex flex-col items-center justify-center text-center p-6 select-none animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 text-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(52,211,153,0.2)] mb-4 animate-glow-pulse">
                    <Lock size={24} className="stroke-[2.5]" />
                  </div>
                  <h3 className="text-base font-black text-white font-heading tracking-tight">Coding Round Completed</h3>
                  <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed font-semibold">
                    Your final solution has been compiled, evaluated, and saved. Streak stats have been updated in your profile.
                  </p>
                </div>
              )}
              
              {/* Editor toolbar */}
              <div className="min-h-14 bg-slate-950 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 shrink-0">
                <div className="relative flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded bg-white/5 text-slate-400">
                    <Globe size={13} />
                  </div>
                  <select
                    value={language}
                    onChange={(event) => handleLanguageChange(event.target.value)}
                    disabled={isCompleted}
                    className="premium-input text-xs font-bold bg-slate-900 border border-white/10 rounded-lg py-1.5 pl-2 pr-7 outline-none appearance-none cursor-pointer text-slate-300 focus:border-emerald-400"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Console Toggle */}
                  <button
                    onClick={() => setConsoleOpen((prev) => !prev)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all select-none border border-transparent mr-1"
                  >
                    <Terminal size={13} />
                    <span>Console</span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${consoleOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Outlined Run Code button */}
                  <button
                    onClick={() => submitSolution("run")}
                    disabled={Boolean(loadingAction) || isCompleted || !question || !code.trim()}
                    className="ghost-button text-xs py-1.5 px-4 flex items-center gap-1.5"
                  >
                    {loadingAction === "run" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Play size={13} />
                    )}
                    <span>Run Code</span>
                  </button>
                  
                  {/* Filled Submit Code button */}
                  <button
                    onClick={() => submitSolution("submit")}
                    disabled={Boolean(loadingAction) || isCompleted || !question || !code.trim() || hasSubmittedCurrentQuestion}
                    className="premium-button text-xs font-black uppercase tracking-wider py-1.5 px-4 shadow-[0_0_15px_rgba(52,211,153,0.15)] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAction === "submit" ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    <span>Submit Solution</span>
                  </button>
                </div>
              </div>

              {/* Editor Frame: flex-1 min-h-0 */}
              <div className="flex-1 min-h-0 w-full overflow-hidden">
                <Editor
                  height="100%"
                  language={monacoLanguage[language]}
                  value={code}
                  onChange={(value) => setCode(value || "")}
                  theme="vs-dark"
                  options={{
                    fontSize: 13,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    padding: { top: 12 },
                    readOnly: isCompleted
                  }}
                />
              </div>

              {/* Toggleable Console Panel */}
              {consoleOpen && (
                <div className="shrink-0 bg-[#0a0f1d] border-t border-white/8 flex flex-col h-[280px] z-10 relative">
                  {/* Console Tab Bar */}
                  <div className="flex gap-1.5 px-3 pt-2 border-b border-white/8 bg-white/[0.02] shrink-0">
                    <button
                      onClick={() => setActiveConsoleTab("testcase")}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all border-b-0 ${
                        activeConsoleTab === "testcase"
                          ? "text-white bg-[#0e1629] border-t border-x border-white/8 -mb-px relative z-10"
                          : "text-slate-500 hover:text-white"
                      }`}
                    >
                      Test Cases
                    </button>
                    <button
                      onClick={() => setActiveConsoleTab("result")}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all border-b-0 ${
                        activeConsoleTab === "result"
                          ? "text-white bg-[#0e1629] border-t border-x border-white/8 -mb-px relative z-10"
                          : "text-slate-500 hover:text-white"
                      }`}
                    >
                      AI Evaluation
                    </button>
                  </div>

                  {/* Console Content */}
                  <div className="flex-1 overflow-y-auto p-4 text-xs sm:text-sm scrollbar-thin scrollbar-thumb-white/10 font-semibold leading-relaxed">
                    {/* Test Cases Tab */}
                    {activeConsoleTab === "testcase" && (
                      <div>
                        {loadingAction === "run" || loadingAction === "submit" ? (
                          <div className="flex items-center gap-3 text-slate-400 p-2">
                            <span className="loading loading-spinner loading-sm text-emerald-400"></span>
                            <span>Executing test cases...</span>
                          </div>
                        ) : result?.executionResult ? (
                          <div className="space-y-4">
                            <div className={`font-bold flex items-center gap-2 text-sm uppercase tracking-wider ${result.executionResult.success ? "text-emerald-400" : "text-red-400"}`}>
                              {result.executionResult.success ? (
                                <CheckCircle2 size={16} className="text-emerald-400" />
                              ) : (
                                <AlertTriangle size={16} className="text-red-400" />
                              )}
                              <span>
                                {result.executionResult.success ? "All sample test cases passed!" : "Some test cases failed"}
                              </span>
                            </div>
                            <div className="flex gap-4 text-xs text-slate-500 border-b border-white/5 pb-2">
                              <span>
                                <strong className="text-slate-400">Passed:</strong> {result.executionResult.passedCount} / {result.executionResult.totalCount}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {(result.executionResult.testCases || []).map((tc, i) => (
                                <div key={i} className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-2 relative shadow-inner">
                                  <div className={`absolute top-4 right-4 font-extrabold text-[10px] uppercase tracking-widest px-2 py-0.5 border rounded ${tc.status_id === 3 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"}`}>
                                    {tc.status_id === 3 ? "Passed" : "Failed"}
                                  </div>
                                  <div className="font-extrabold text-slate-300 text-xs uppercase tracking-wider mb-2">Case {i + 1}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Input</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-slate-300 font-semibold">{tc.stdin || "N/A"}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Output</div>
                                  <div className={`bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono font-semibold ${tc.status_id === 3 ? "text-emerald-300" : "text-red-400"}`}>{tc.stdout || "Execution Error / Timeout"}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Expected</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-slate-400 font-semibold">{tc.expected_output || "N/A"}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-8 select-none">
                            <Terminal size={32} className="text-slate-600 mb-1" />
                            <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Run code to inspect compiler output.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Evaluation Tab */}
                    {activeConsoleTab === "result" && (
                      <div>
                        {loadingAction === "run" || loadingAction === "submit" ? (
                          <div className="flex items-center gap-3 text-slate-400 p-2">
                            <span className="loading loading-spinner loading-sm text-emerald-400"></span>
                            <span>Evaluating solution with AI...</span>
                          </div>
                        ) : result?.evaluation ? (
                          <div className="space-y-4">
                            {/* Summary Metrics */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Correctness</p>
                                <p className={`text-xl font-black mt-1 ${result.evaluation.correctnessScore >= 80 ? "text-emerald-400" : result.evaluation.correctnessScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                                  {result.evaluation.correctnessScore}%
                                </p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Time Complex</p>
                                <p className="text-xs font-black text-blue-400 mt-2 truncate">
                                  {result.evaluation.timeComplexity || "O(N)"}
                                </p>
                              </div>
                              <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 shadow-inner">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Space Complex</p>
                                <p className="text-xs font-black text-violet-400 mt-2 truncate">
                                  {result.evaluation.spaceComplexity || "O(1)"}
                                </p>
                              </div>
                            </div>

                            {/* Overall Feedback */}
                            {result.evaluation.overallFeedback && (
                              <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4 text-xs leading-relaxed text-slate-200">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
                                  <CheckCircle2 size={12} className="text-emerald-400" />
                                  <span>AI Analysis Feedback</span>
                                </h3>
                                <p>{result.evaluation.overallFeedback}</p>
                              </div>
                            )}

                            {/* Detailed insights */}
                            <div className="space-y-4 pt-2">
                              {/* Strengths */}
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                                  <ShieldCheck size={12} />
                                  <span>Strengths</span>
                                </h4>
                                <ul className="space-y-2">
                                  {(result.evaluation.strengths || []).map((item, idx) => (
                                    <li key={idx} className="text-xs leading-relaxed border border-emerald-500/15 bg-emerald-500/5 text-slate-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                                      <ChevronRight size={14} className="shrink-0 mt-0.5 text-emerald-400/40" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                  {(result.evaluation.strengths || []).length === 0 && (
                                    <li className="text-xs text-slate-500 italic px-2">No strengths listed.</li>
                                  )}
                                </ul>
                              </div>

                              {/* Weaknesses */}
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  <span>Weaknesses & Gaps</span>
                                </h4>
                                <ul className="space-y-2">
                                  {(result.evaluation.weaknesses || []).map((item, idx) => (
                                    <li key={idx} className="text-xs leading-relaxed border border-red-500/15 bg-red-500/5 text-slate-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                                      <ChevronRight size={14} className="shrink-0 mt-0.5 text-red-400/40" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                  {(result.evaluation.weaknesses || []).length === 0 && (
                                    <li className="text-xs text-slate-500 italic px-2">No weaknesses listed.</li>
                                  )}
                                </ul>
                              </div>

                              {/* Optimizations */}
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1">
                                  <Flame size={12} />
                                  <span>Optimizations</span>
                                </h4>
                                <ul className="space-y-2">
                                  {(result.evaluation.optimizationSuggestions || []).map((item, idx) => (
                                    <li key={idx} className="text-xs leading-relaxed border border-blue-500/15 bg-blue-500/5 text-slate-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                                      <ChevronRight size={14} className="shrink-0 mt-0.5 text-blue-400/40" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                  {(result.evaluation.optimizationSuggestions || []).length === 0 && (
                                    <li className="text-xs text-slate-500 italic px-2">No optimizations listed.</li>
                                  )}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-8 select-none">
                            <Sparkles size={32} className="text-slate-600 mb-1" />
                            <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Submit solution to see AI metrics & scorecard logs.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <ConfirmationDialog
        open={confirmEndOpen}
        title="Generate final interview scorecard?"
        description="This will lock all compiler and editor triggers, generate runtime feedback, and update your consistency achievements."
        confirmText="Confirm End Round"
        onCancel={() => setConfirmEndOpen(false)}
        onConfirm={() => {
          setConfirmEndOpen(false);
          handleGenerateScorecard();
        }}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default CodingInterviewWorkspace;
