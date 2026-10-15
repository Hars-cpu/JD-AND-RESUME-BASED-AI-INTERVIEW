/**
 * @file ProblemPage.jsx
 * @summary React view page displaying the workspace cockpit for solving a specific problem.
 *          It provides a split-pane interface with problem descriptions, video editorials, reference
 *          solutions, an AI chat assistant, and a Monaco-based code editor with test execution.
 * @functions
 * - sanitizeHTML: Cleans the problem description HTML to prevent XSS.
 * - starterMatchesLanguage: Checks if a given starter code snippet matches the currently selected language.
 * - ProblemPage: Main component rendering the split-pane problem solving interface.
 * - fetchProblem: Retrieves the full problem details and test cases from the backend.
 * - handleEditorChange: Updates the code state when the Monaco editor content changes.
 * - handleEditorDidMount: Captures the Monaco editor instance for direct API access.
 * - handleLanguageChange: Switches the active programming language.
 * - toggleLeftPane: Collapses or expands the left information pane.
 * - getCurrentStarterCode: Retrieves the starter code template for the active language.
 * - getCurrentEditorCode: Retrieves the current content of the Monaco editor.
 * - getSubmissionStatus: Formats the recent run and submit results for the AI assistant context.
 * - handleRun: Executes the current code against the sample test cases via Judge0.
 * - handleSubmitCode: Submits the current code against all hidden test cases for final evaluation.
 * - getLanguageForMonaco: Maps the selected language string to the Monaco editor language identifier.
 */

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import Editor from '@monaco-editor/react';
import { useParams, NavLink } from 'react-router';
import { Code2 } from 'lucide-react';
import axiosClient from '../utils/axiosClient';
import SubmissionHistory from '../components/SubmissionHistory';
import ChatAi from '../components/Chatai';
import Editorial from '../components/Editorial';
import { BrainCircuit, PanelLeftClose, PanelLeftOpen, Play, Send, Terminal } from 'lucide-react';

const langMap = {
  cpp: 'C++',
  java: 'Java',
  javascript: 'JavaScript',
};

const DIFF_COLORS = {
  easy: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.06)]',
  medium: 'text-amber-400 bg-amber-500/10 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.06)]',
  hard: 'text-rose-400 bg-rose-500/10 border border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.06)]',
};

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

const sanitizeHTML = (html) => {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<iframe[^>]*>([\s\S]*?)<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*(['"][^'"]*['"]|[^\s>]+)/gi, '');
};

const starterMatchesLanguage = (starter, selectedLanguage) => {
  const starterLanguage = String(starter?.language || '').toLowerCase();
  const selectedLabel = String(langMap[selectedLanguage] || '').toLowerCase();
  return starterLanguage === selectedLanguage || starterLanguage === selectedLabel;
};

const ProblemPage = () => {
  const [problem, setProblem] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [activeLeftTab, setActiveLeftTab] = useState('description');
  const [activeRightTab, setActiveRightTab] = useState('testcase');
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('algopilot-problem-left-collapsed') === 'true';
  });
  const editorRef = useRef(null);
  const { problemId } = useParams();

  useEffect(() => {
    const fetchProblem = async () => {
      setLoading(true);
      try {
        const response = await axiosClient.get(`/problem/problemById/${problemId}`);
        setProblem(response.data);
      } catch (error) {
        console.error('Error fetching problem:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProblem();
  }, [problemId]);

  useEffect(() => {
    if (problem) {
      const found = problem?.startCode?.find((sc) => starterMatchesLanguage(sc, selectedLanguage));
      setCode(found?.initialCode || '// Language not available...');
    }
  }, [selectedLanguage, problem]);

  const handleEditorChange = (value) => setCode(value || '');
  const handleEditorDidMount = (editor) => { editorRef.current = editor; };
  const handleLanguageChange = (language) => setSelectedLanguage(language);
  const toggleLeftPane = () => {
    setLeftCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem('algopilot-problem-left-collapsed', String(next));
      return next;
    });
  };

  const getCurrentStarterCode = () => {
    const starter = problem?.startCode?.find((sc) => starterMatchesLanguage(sc, selectedLanguage));
    return starter?.initialCode || '';
  };

  const getCurrentEditorCode = () => editorRef.current?.getValue?.() ?? code;

  const getSubmissionStatus = () => ({
    lastRun: runResult ? {
      success: Boolean(runResult.success),
      error: runResult.error || '',
      runtime: runResult.runtime || null,
      memory: runResult.memory || null,
      testCases: runResult.testCases || []
    } : null,
    lastSubmit: submitResult ? {
      accepted: Boolean(submitResult.accepted),
      error: submitResult.error || '',
      passedTestCases: submitResult.passedTestCases || 0,
      totalTestCases: submitResult.totalTestCases || 0,
      runtime: submitResult.runtime || null,
      memory: submitResult.memory || null
    } : null
  });

  const handleRun = async () => {
    setLoading(true);
    setRunResult(null);
    setConsoleOpen(true);
    setActiveRightTab('testcase');
    try {
      const response = await axiosClient.post(`/submission/run/${problemId}`, {
        code,
        language: selectedLanguage,
      });
      setRunResult(response.data);
    } catch (error) {
      console.error('Error running code:', error);
      setRunResult({ success: false, error: 'Internal server error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitCode = async () => {
    setLoading(true);
    setSubmitResult(null);
    setConsoleOpen(true);
    setActiveRightTab('result');
    try {
      const response = await axiosClient.post(`/submission/submit/${problemId}`, {
        code,
        language: selectedLanguage,
      });
      setSubmitResult(response.data);
    } catch (error) {
      console.error('Error submitting code:', error);
      setSubmitResult({
        accepted: false,
        error: 'Internal server error',
        passedTestCases: 0,
        totalTestCases: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getLanguageForMonaco = (lang) => {
    switch (lang) {
      case 'javascript': return 'javascript';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      default: return 'javascript';
    }
  };

  if (loading && !problem) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-950">
        <span className="loading loading-spinner text-emerald-400 loading-lg"></span>
      </div>
    );
  }

  const tagList = Array.isArray(problem?.tags)
    ? problem.tags
    : problem?.tags
    ? [problem.tags]
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans lg:h-screen lg:overflow-hidden">

      {/* Premium workspace top bar */}
      <nav className="min-h-14 bg-slate-950/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 shrink-0 z-50 backdrop-blur-xl">
        <NavLink to="/dashboard" className="flex items-center gap-3 group no-underline">
          <div className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.18)] transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <img src="/logo.png" alt="ALGOPILOT Logo" className="w-5 h-5 object-contain drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-white font-heading m-0 leading-none">
              ALGOPILOT
            </p>
            <p className="text-[8px] font-semibold uppercase tracking-[0.24em] text-slate-500 m-0 mt-1 leading-none">Career cockpit</p>
          </div>
        </NavLink>
        <div className="flex gap-3">
          <NavLink
            to="/dashboard"
            className="text-sm font-semibold text-slate-400 hover:text-white transition-colors self-center no-underline"
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/problems"
            className="text-sm font-semibold text-slate-400 hover:text-white transition-colors self-center no-underline"
          >
            Problems
          </NavLink>
        </div>
      </nav>

      {/* Main split workspace */}
      <div className="flex flex-1 flex-col gap-3 p-3 lg:flex-row lg:overflow-hidden bg-slate-950">

        {/* ════ LEFT PANE: Problem Info ════ */}
        <div className={`flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-xl transition-all duration-300 ${leftCollapsed ? "lg:w-[86px]" : "lg:w-[46%]"}` }>

          {leftCollapsed ? (
            <div className="hidden flex-1 flex-col items-center gap-3 p-3 lg:flex">
              <button
                onClick={toggleLeftPane}
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 mb-2"
                title="Expand problem panel"
              >
                <PanelLeftOpen size={18} />
              </button>
              {['description', 'chatAI', 'submissions'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveLeftTab(tab);
                    toggleLeftPane();
                  }}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:border-emerald-400/30 hover:text-emerald-300"
                  title={tab === 'chatAI' ? 'AI Mentor' : tab}
                >
                  {tab === 'chatAI' ? <BrainCircuit size={18} /> : tab === 'submissions' ? <Terminal size={18} /> : <Code2 size={18} />}
                </button>
              ))}
            </div>
          ) : (
            <>
              {/* Left Tab Bar */}
              <div className="flex items-center border-b border-white/10 bg-white/[0.03] px-2 pt-2 gap-2">
                <button
                  onClick={toggleLeftPane}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 mb-1"
                  title="Collapse problem panel"
                >
                  <PanelLeftClose size={16} />
                </button>
                <div className="h-5 w-px bg-white/10 mb-1 shrink-0"></div>
                <div className="flex gap-1 overflow-x-auto flex-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {['description', 'editorial', 'solutions', 'submissions', 'chatAI'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveLeftTab(tab)}
                      className={`px-4 py-2 text-sm font-semibold capitalize rounded-t-lg transition-all whitespace-nowrap border-b-0 ${
                        activeLeftTab === tab
                          ? 'bg-slate-950 text-white border border-white/10 border-b-transparent -mb-px relative z-10'
                          : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5 border-transparent'
                      }`}
                    >
                      {tab === 'chatAI' ? 'ChatAI ✨' : tab}
                    </button>
                  ))}
                </div>
              </div>

          {/* Left Content */}
          <div className="flex-1 overflow-y-auto bg-slate-900/40 p-5 sm:p-6 scrollbar-thin scrollbar-thumb-white/10">
            {problem && (
              <>
                {/* Description Tab */}
                {activeLeftTab === 'description' && (
                  <div className="animate-fade-in text-slate-200">
                    <div className="mb-6 border-b border-white/8 pb-6">
                      <h1 className="text-2xl font-black mb-4 text-white tracking-tight">{problem.title}</h1>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider capitalize ${
                            DIFF_COLORS[problem.difficulty?.toLowerCase()] || DIFF_COLORS.medium
                          }`}
                        >
                          {problem.difficulty}
                        </span>
                        {tagList.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 border border-white/5 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 transition-all select-none"
                          >
                            {TAG_LABELS[tag] || tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="prose prose-invert max-w-none mb-8 text-[14px] sm:text-[15px] leading-relaxed text-slate-300 font-medium">
                      <div
                        dangerouslySetInnerHTML={{ __html: sanitizeHTML(problem.description) }}
                        className="whitespace-pre-wrap leading-relaxed"
                      />
                    </div>

                    <div className="space-y-5">
                      <h3 className="text-base font-black text-white border-b border-white/8 pb-2 tracking-tight select-none">
                        Examples
                      </h3>
                      {problem.visibleTestCases?.map((example, index) => (
                        <div
                          key={index}
                          className="bg-slate-950/40 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10 shadow-inner"
                        >
                          <div className="bg-white/[0.02] px-4 py-2.5 border-b border-white/5 font-extrabold text-xs text-slate-400 uppercase tracking-widest select-none">
                            Example {index + 1}
                          </div>
                          <div className="p-4.5 space-y-3 text-xs sm:text-sm font-semibold">
                            <div className="flex gap-2">
                              <span className="text-slate-500 font-extrabold select-none shrink-0 w-16">Input:</span>
                              <code className="text-cyan-300 font-mono break-all">{example.input}</code>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-slate-500 font-extrabold select-none shrink-0 w-16">Output:</span>
                              <code className="text-emerald-400 font-mono break-all">{example.output}</code>
                            </div>
                            {example.explanation && (
                              <div className="flex gap-2 pt-2 border-t border-white/[0.02]">
                                <span className="text-slate-500 font-extrabold select-none shrink-0 w-16">Explanation:</span>
                                <span className="text-slate-400 italic break-words leading-relaxed">
                                  {example.explanation}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {problem.constraints && (
                      <div className="mt-8 border-t border-white/8 pt-6">
                        <h3 className="text-base font-black text-white mb-4 tracking-tight select-none">Constraints</h3>
                        <ul className="list-disc pl-5 space-y-2 text-xs font-semibold text-slate-400">
                          {(Array.isArray(problem.constraints) ? problem.constraints : [problem.constraints]).map((con, idx) => (
                            <li key={idx}>
                              <code className="px-1.5 py-0.5 rounded bg-slate-950 border border-white/8 font-mono text-cyan-300">{con}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Editorial Tab */}
                {activeLeftTab === 'editorial' && (
                  <div className="animate-fade-in text-slate-200">
                    <h2 className="text-xl font-bold mb-6 border-b border-white/10 pb-2 text-white">
                      Video Editorial
                    </h2>
                    <Editorial
                      secureUrl={problem?.video?.secureUrl}
                      thumbnailUrl={problem?.video?.thumbnailUrl}
                      duration={problem?.video?.duration}
                    />
                  </div>
                )}

                {/* Solutions Tab */}
                {activeLeftTab === 'solutions' && (
                  <div className="animate-fade-in text-slate-200">
                    <h2 className="text-xl font-bold mb-6 border-b border-white/10 pb-2 text-white">
                      Reference Solutions
                    </h2>
                    {problem.referenceSolution && problem.referenceSolution.length > 0 ? (
                      <div className="space-y-6">
                        {problem.referenceSolution.map((solution, index) => (
                          <div
                            key={index}
                            className="border border-white/10 rounded-xl overflow-hidden shadow-sm"
                          >
                            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center gap-2">
                              <span className="font-semibold text-slate-200">{solution?.language}</span>
                            </div>
                            <pre className="p-4 bg-[#1e1e1e] text-[#d4d4d4] text-sm font-mono overflow-x-auto m-0 leading-relaxed">
                              <code>{solution?.completeCode}</code>
                            </pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="font-medium text-slate-300">Solutions are locked.</p>
                        <p className="text-sm mt-1">Try solving the problem first!</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Submissions Tab */}
                {activeLeftTab === 'submissions' && (
                  <div className="animate-fade-in text-slate-200">
                    <h2 className="text-xl font-bold mb-6 border-b border-white/10 pb-2 text-white">
                      My Submissions
                    </h2>
                    <SubmissionHistory problemId={problemId} />
                  </div>
                )}

                {/* ChatAI Tab */}
                {activeLeftTab === 'chatAI' && (
                  <div className="animate-fade-in text-slate-200 h-full">
                    <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-2 flex items-center gap-2 text-white">
                      <span className="text-emerald-400">AI</span> Assistant
                    </h2>
                    <ChatAi
                      problem={problem}
                      activeCode={getCurrentEditorCode()}
                      startCode={getCurrentStarterCode()}
                      language={selectedLanguage}
                      submissionStatus={getSubmissionStatus()}
                    />
                  </div>
                )}
              </>
            )}
          </div>
            </>
          )}
        </div>

        {/* Right pane: code editor */}
        <div className={`flex min-h-[620px] flex-col bg-slate-900/60 rounded-2xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 ${leftCollapsed ? "lg:w-[calc(100%-98px)]" : "lg:w-[54%]"}` }>

          {/* ── Editor Top Bar: Language Selector ── */}
          <div className="min-h-12 bg-slate-950/80 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 px-4 py-2 shrink-0">
            {/* Language Tabs */}
            <div className="flex gap-1.5">
              {['javascript', 'java', 'cpp'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleLanguageChange(lang)}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all border ${
                    selectedLanguage === lang
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-transparent text-slate-400 border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  {langMap[lang]}
                </button>
              ))}
            </div>

            {/* Console Toggle */}
            <button
              onClick={() => setConsoleOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all select-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3" />
              </svg>
              <span>Console</span>
              <svg
                className={`w-3 h-3 transition-transform ${consoleOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* ── Monaco Editor ── */}
          <div className={`flex-1 overflow-hidden ${consoleOpen ? 'min-h-0' : ''}`}>
            <Editor
              height="100%"
              language={getLanguageForMonaco(selectedLanguage)}
              value={code}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 22,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontLigatures: true,
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                scrollbar: {
                  verticalScrollbarSize: 6,
                  horizontalScrollbarSize: 6,
                },
              }}
            />
          </div>

          {/* ── Console Panel ── */}
          {consoleOpen && (
            <div className="shrink-0 bg-[#0a0f1d] border-t border-white/10 flex flex-col" style={{ height: '260px' }}>
              {/* Console Tab Bar */}
              <div className="flex gap-1.5 px-3 pt-2 border-b border-white/10 bg-white/[0.02] shrink-0">
                {['testcase', 'result'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveRightTab(tab)}
                    className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-lg transition-all border-b-0 ${
                      activeRightTab === tab
                        ? 'text-white bg-[#0e1629] border border-white/10 -mb-px relative z-10'
                        : 'text-slate-500 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab === 'testcase' ? 'Test Cases' : 'Result'}
                  </button>
                ))}
              </div>

              {/* Console Content */}
              <div className="flex-1 overflow-y-auto p-4 text-xs sm:text-sm scrollbar-thin scrollbar-thumb-white/10 font-semibold leading-relaxed">
                {/* ─ Test Cases Tab ─ */}
                {activeRightTab === 'testcase' && (
                  <div>
                    {loading ? (
                      <div className="flex items-center gap-3 text-slate-400 p-2">
                        <span className="loading loading-spinner loading-sm text-emerald-400"></span>
                        Running test cases...
                      </div>
                    ) : runResult ? (
                      <div>
                        {runResult.success ? (
                          <div className="space-y-4">
                            <div className="text-emerald-400 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                              All sample test cases passed!
                            </div>
                            <div className="flex gap-4 text-xs text-slate-500 border-b border-white/5 pb-2">
                              <span><strong className="text-slate-400">Runtime:</strong> {runResult.runtime}s</span>
                              <span><strong className="text-slate-400">Memory:</strong> {runResult.memory} KB</span>
                            </div>
                            <div className="space-y-3">
                              {runResult.testCases?.map((tc, i) => (
                                <div key={i} className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-2 relative shadow-inner">
                                  <div className="absolute top-4 right-4 text-emerald-400 font-extrabold text-[10px] uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">
                                    Passed
                                  </div>
                                  <div className="font-extrabold text-slate-300 text-xs uppercase tracking-wider mb-2">Case {i + 1}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Input</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-slate-300 font-semibold">{tc.stdin}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Output</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-emerald-300 font-semibold">{tc.stdout}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Expected</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-slate-400 font-semibold">{tc.expected_output}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="text-red-400 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {runResult.error || 'Test cases failed'}
                            </div>
                            <div className="space-y-3">
                              {runResult.testCases?.map((tc, i) => (
                                <div key={i} className="bg-slate-950/40 border border-white/5 p-4 rounded-xl space-y-2 relative shadow-inner">
                                  {tc.status_id === 3 || String(tc.status_id).toLowerCase() === 'accepted' ? (
                                    <div className="absolute top-4 right-4 text-emerald-400 font-extrabold text-[10px] uppercase tracking-widest px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded">Passed</div>
                                  ) : (
                                    <div className="absolute top-4 right-4 text-red-400 font-extrabold text-[10px] uppercase tracking-widest px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded">Failed</div>
                                  )}
                                  <div className="font-extrabold text-slate-300 text-xs uppercase tracking-wider mb-2">Case {i + 1}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Input</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-slate-300 font-semibold">{tc.stdin || 'N/A'}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Your Output</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-red-400 font-semibold">{tc.stdout || 'Execution Error / Timeout'}</div>
                                  <div className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-2">Expected</div>
                                  <div className="bg-[#05070f] px-3 py-2 rounded-lg border border-white/5 text-xs font-mono text-slate-400 font-semibold">{tc.expected_output || 'N/A'}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 py-8 select-none">
                        <svg className="w-10 h-10 text-slate-600 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span className="text-xs font-bold tracking-wider uppercase text-slate-500">Run your code to see test case output.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Result Tab ─ */}
                {activeRightTab === 'result' && (
                  <div>
                    {loading ? (
                      <div className="flex items-center gap-3 text-slate-400 p-2">
                        <span className="loading loading-spinner loading-sm text-emerald-400"></span>
                        Judging your submission...
                      </div>
                    ) : submitResult ? (
                      <div className="animate-fade-up">
                        {submitResult.accepted ? (
                          <div className="space-y-4">
                            <h3 className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.35)] select-none">
                              Accepted! 🎉
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl shadow-inner">
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5 select-none">Runtime</div>
                                <div className="text-xl font-black text-slate-100 font-heading">
                                  {submitResult.runtime} <span className="text-xs font-bold text-slate-500 uppercase">ms</span>
                                </div>
                              </div>
                              <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl shadow-inner">
                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5 select-none">Memory</div>
                                <div className="text-xl font-black text-slate-100 font-heading">
                                  {submitResult.memory} <span className="text-xs font-bold text-slate-500 uppercase">KB</span>
                                </div>
                              </div>
                            </div>
                            <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between shadow-inner font-bold">
                              <span className="text-slate-400 text-xs font-extrabold uppercase tracking-wider">Test Cases Passed</span>
                              <span className="text-emerald-400 font-black">
                                {submitResult.passedTestCases} / {submitResult.totalTestCases}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <h3 className="text-xl font-black text-red-400 uppercase tracking-wide select-none">
                              {submitResult.error || 'Wrong Answer'}
                            </h3>
                            <div className="p-4 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between shadow-inner font-bold">
                              <span className="text-slate-400 text-xs font-extrabold uppercase tracking-wider">Test Cases Passed</span>
                              <span className="text-slate-400 font-black">
                                <span className="text-red-400 font-black">{submitResult.passedTestCases}</span>{' '}
                                / {submitResult.totalTestCases}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 py-8 text-xs font-bold tracking-wider uppercase select-none">
                        Submit your code to see the final evaluation.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Action Buttons Bar ── */}
          <div className="min-h-14 bg-slate-950 border-t border-white/10 px-4 py-3 flex flex-wrap items-center justify-end gap-3 shrink-0">
            <button
              onClick={handleRun}
              disabled={loading}
              className="ghost-button text-xs py-2 px-4 font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              Run Code
            </button>
            <button
              onClick={handleSubmitCode}
              disabled={loading}
              className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.15)] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Submit Code</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProblemPage;







