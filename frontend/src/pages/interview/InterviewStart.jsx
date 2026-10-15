/**
 * @file InterviewStart.jsx
 * @description Mock Interview session setup dashboard. Allows users to choose
 * their interview type (Technical, HR, Generative AI, Coding, or Full Mock) and
 * upload their Resume & Job Description (JD) to automatically customize the interview focus.
 */

import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  ArrowLeft,
  Bot,
  Briefcase,
  CheckCircle2,
  Code2,
  FileText,
  Layers,
  Loader2,
  Sparkles,
  UploadCloud,
  Rocket,
  ChevronRight,
  ChevronDown,
  Plus
} from "lucide-react";
import axiosClient from "../../utils/axiosClient";
import ResumeInterviewCard from "../../components/interview/ResumeInterviewCard";
import { ErrorState, Toast } from "../../components/interview/FeedbackUI";

// Pre-configured mock interview formats/templates
const templates = [
  {
    value: "technical",
    label: "Technical",
    icon: Layers,
    focus: "DSA, OOPS, DBMS, OS, CN, and projects"
  },
  {
    value: "hr",
    label: "HR",
    icon: Briefcase,
    focus: "Introductions, strengths, leadership, teamwork, and conflict resolution"
  },
  {
    value: "genai",
    label: "Generative AI",
    icon: Sparkles,
    focus: "LLMs, prompt engineering, RAG, embeddings, LangChain, agents, and vector databases"
  },
  {
    value: "coding",
    label: "Coding Round",
    icon: Code2,
    focus: "Coding mock interview round and Monaco algorithmic problem solving"
  },
  {
    value: "full-mock",
    label: "Full Mock",
    icon: Bot,
    focus: "HR, technical core, projects, GenAI, and coding readiness"
  }
];

const defaultResumeData = {
  skills: [],
  projects: [],
  experience: [],
  education: [],
  summary: ""
};

const defaultJdData = {
  requiredSkills: [],
  preferredSkills: [],
  technologies: [],
  responsibilities: [],
  experienceRequired: "",
  keywords: []
};

const defaultAnalysisData = {
  matchScore: 0,
  matchedSkills: [],
  missingSkills: [],
  strongAreas: [],
  weakAreas: [],
  interviewFocusAreas: [],
  recommendations: []
};

/**
 * StepBadge Component
 * Renders a visual badge displaying step numbering and completion states.
 */
function StepBadge({ number, title, complete, active }) {
  return (
    <div className={`rounded-xl border px-4 py-3 shrink-0 sm:shrink transition-all duration-300 ${
      complete 
        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
        : active 
          ? "border-emerald-400 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.1)]" 
          : "border-white/5 bg-slate-900/30 text-slate-500"
    }`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
          complete 
            ? "bg-emerald-400 text-slate-950" 
            : active 
              ? "bg-emerald-400 text-slate-950" 
              : "bg-slate-800 text-slate-500"
        }`}>
          {complete ? <CheckCircle2 size={13} className="stroke-[3]" /> : number}
        </span>
        <span className="text-xs font-bold leading-none">{title}</span>
      </div>
    </div>
  );
}

/**
 * UploadPanel Component
 * Renders a drag-and-drop container for uploading and parsing PDF files (Resume/JD).
 */
function UploadPanel({ title, description, file, parsedData, loading, fieldId, onFileChange, onUpload }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl flex flex-col">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 shrink-0">
        <h2 className="text-sm font-black text-white font-heading tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
      
      <div className="p-5 space-y-4 flex-1">
        {/* Upload zone supporting Drag and Drop with visual highlight */}
        <label 
          htmlFor={fieldId} 
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`block rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-all duration-300 ${
            dragActive 
              ? "border-emerald-400 bg-emerald-500/10 scale-[1.01] shadow-[0_0_15px_rgba(52,211,153,0.15)]" 
              : "border-white/10 bg-slate-950/40 hover:border-emerald-500/20"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 flex items-center justify-center shrink-0 shadow-lg">
              <UploadCloud size={20} className={dragActive ? "animate-bounce" : ""} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{file?.name || "Choose or Drag PDF File"}</p>
              <p className="text-xs text-slate-500 mt-1">PDF snap only, max 5 MB</p>
            </div>
          </div>
          <input
            id={fieldId}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
            className="sr-only"
          />
        </label>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            onClick={() => onUpload()}
            disabled={!file || loading}
            className="premium-button text-xs py-2 px-4 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <FileText size={13} />
                <span>Upload and Parse</span>
              </>
            )}
          </button>

          {parsedData && (
            <span className="premium-badge-green text-[10px] py-1.5 px-3 font-extrabold flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              <span>Parsed Snapshot</span>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function TagList({ title, items }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {(items || []).length === 0 ? (
          <span className="text-xs text-slate-500 italic px-1">No tags resolved</span>
        ) : (
          items.map((item) => (
            <span key={item} className="premium-badge-blue text-[10px] py-0.5 px-2.5 font-bold uppercase select-all">
              {item}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function AnalysisReview({ analysisData }) {
  if (!analysisData) return null;

  // Counter Sweep animation on matchScore load
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const target = Number(analysisData.matchScore) || 0;
    if (target === 0) {
      setAnimatedScore(0);
      return;
    }
    let start = 0;
    const interval = setInterval(() => {
      start += 2;
      if (start >= target) {
        setAnimatedScore(target);
        clearInterval(interval);
      } else {
        setAnimatedScore(start);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [analysisData]);

  return (
    <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl animate-fade-up">
      <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-white font-heading tracking-tight">Match Analytics Review</h2>
          <p className="text-xs text-slate-400 mt-1">Snapshot matching metrics saved into the session</p>
        </div>
        
        {/* Glowing match score chip */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-right shadow-[0_0_15px_rgba(52,211,153,0.1)]">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Match rating</p>
          <p className="text-2xl font-black text-white font-heading leading-tight">{animatedScore}%</p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-950/20">
        <TagList title="Matched Core Skills" items={analysisData.matchedSkills} />
        <TagList title="Missing Requirements" items={analysisData.missingSkills} />
        <TagList title="Strong Highlight Areas" items={analysisData.strongAreas} />
        <TagList title="Improvement Gaps" items={analysisData.weakAreas} />
        <TagList title="Interview Focus Paths" items={analysisData.interviewFocusAreas} />
        <TagList title="Target Recommendations" items={analysisData.recommendations} />
      </div>
    </section>
  );
}

function InterviewStart() {
  const navigate = useNavigate();
  const [templateType, setTemplateType] = useState("technical");
  const [interviewType, setInterviewType] = useState("mock");
  const [resumeFile, setResumeFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [jdData, setJdData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [advancedResumeData, setAdvancedResumeData] = useState(JSON.stringify(defaultResumeData, null, 2));
  const [advancedJdData, setAdvancedJdData] = useState(JSON.stringify(defaultJdData, null, 2));
  const [advancedAnalysisData, setAdvancedAnalysisData] = useState(JSON.stringify(defaultAnalysisData, null, 2));
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [activeSessionLoading, setActiveSessionLoading] = useState(true);
  const [resumeAction, setResumeAction] = useState("");
  const [toast, setToast] = useState(null);

  const getApiErrorMessage = (error, fallback) => {
    const responseBody = error.response?.data;
    if (responseBody?.error) return responseBody.error;
    if (typeof responseBody === "string") {
      if (error.response?.status === 401) return "Your session expired. Please log in again.";
      return responseBody;
    }
    if (!error.response) return "Network error. Please check your connection and try again.";
    return fallback;
  };

  const logApiFailure = (label, endpoint, error) => {
    console.error(`[InterviewStart] ${label} failed`, {
      url: `${axiosClient.defaults.baseURL || ""}${endpoint}`,
      statusCode: error.response?.status || "NETWORK_ERROR",
      responseBody: error.response?.data || error.message
    });
  };

  useEffect(() => {
    const loadActiveSession = async () => {
      try {
        const { data } = await axiosClient.get("/api/interview/active-session");
        setActiveSession(data);
      } catch (loadError) {
        if (loadError.response?.status !== 404) {
          setError(loadError.response?.data?.error || "Failed to check active interview session");
        }
      } finally {
        setActiveSessionLoading(false);
      }
    };

    loadActiveSession();
  }, []);

  const currentStep = useMemo(() => {
    if (!resumeData) return 1;
    if (!jdData) return 2;
    if (!analysisData) return 3;
    return 4;
  }, [resumeData, jdData, analysisData]);

  const parseJson = (label, value) => {
    try {
      return JSON.parse(value);
    } catch (parseError) {
      throw new Error(`${label} must be valid JSON`);
    }
  };

  const uploadPdf = async ({ file, endpoint, fieldName }) => {
    const formData = new FormData();
    formData.append(fieldName, file);
    const { data } = await axiosClient.post(endpoint, formData);
    return data;
  };

  const handleResumeUpload = async (selectedFile = resumeFile) => {
    try {
      setError("");
      setLoadingAction("resume");
      if (!selectedFile) {
        setError("Select a resume PDF before uploading.");
        return;
      }
      const data = await uploadPdf({
        file: selectedFile,
        endpoint: "/api/interview/resume/upload",
        fieldName: "resume"
      });
      setResumeData(data);
      setAnalysisData(null);
      setAdvancedResumeData(JSON.stringify(data, null, 2));
      setToast({ title: "Resume parsed", message: "Resume uploaded successfully." });
    } catch (uploadError) {
      logApiFailure("Resume upload", "/api/interview/resume/upload", uploadError);
      setError(getApiErrorMessage(uploadError, "Failed to upload and parse resume PDF"));
    } finally {
      setLoadingAction("");
    }
  };

  const handleJdUpload = async (selectedFile = jdFile) => {
    try {
      setError("");
      setLoadingAction("jd");
      if (!selectedFile) {
        setError("Select a JD PDF before uploading.");
        return;
      }
      const data = await uploadPdf({
        file: selectedFile,
        endpoint: "/api/interview/jd/upload",
        fieldName: "jd"
      });
      setJdData(data);
      setAnalysisData(null);
      setAdvancedJdData(JSON.stringify(data, null, 2));
      setToast({ title: "JD parsed", message: "Job description uploaded successfully." });
    } catch (uploadError) {
      logApiFailure("JD upload", "/api/interview/jd/upload", uploadError);
      setError(getApiErrorMessage(uploadError, "Failed to upload and parse JD PDF"));
    } finally {
      setLoadingAction("");
    }
  };

  const handleResumeFileChange = (file) => {
    setResumeFile(file);
    setResumeData(null);
    setAnalysisData(null);
    if (file) {
      handleResumeUpload(file);
    }
  };

  const handleJdFileChange = (file) => {
    setJdFile(file);
    setJdData(null);
    setAnalysisData(null);
    if (file) {
      handleJdUpload(file);
    }
  };

  const handleAnalyze = async () => {
    try {
      setError("");
      setLoadingAction("analysis");
      const finalResumeData = advancedMode ? parseJson("Resume data", advancedResumeData) : resumeData;
      const finalJdData = advancedMode ? parseJson("JD data", advancedJdData) : jdData;

      if (!finalResumeData || !finalJdData) {
        setError("Upload resume and JD before analyzing match.");
        return;
      }

      const { data } = await axiosClient.post("/api/interview/analyze", {
        resumeData: finalResumeData,
        jdData: finalJdData
      });
      setResumeData(finalResumeData);
      setJdData(finalJdData);
      setAnalysisData(data);
      setAdvancedAnalysisData(JSON.stringify(data, null, 2));
      setToast({ title: "Analysis complete", message: "Job matching metrics generated." });
    } catch (analysisError) {
      logApiFailure("Resume/JD analysis", "/api/interview/analyze", analysisError);
      setError(getApiErrorMessage(analysisError, analysisError.message || "Failed to analyze resume against JD"));
    } finally {
      setLoadingAction("");
    }
  };

  const handleStart = async () => {
    try {
      setError("");
      setLoadingAction("start");
      const finalResumeData = advancedMode ? parseJson("Resume data", advancedResumeData) : resumeData;
      const finalJdData = advancedMode ? parseJson("JD data", advancedJdData) : jdData;
      const finalAnalysisData = advancedMode ? parseJson("Analysis data", advancedAnalysisData) : analysisData;

      if (!finalResumeData || !finalJdData || !finalAnalysisData) {
        setError("Complete resume upload, JD upload, and match analysis before starting.");
        return;
      }

      const { data } = await axiosClient.post("/api/interview/session/start", {
        interviewType,
        templateType,
        resumeData: finalResumeData,
        jdData: finalJdData,
        analysisData: finalAnalysisData
      });
      setToast({ title: "Session created", message: "Opening your workspace cockpit." });
      if (interviewType === "coding" || templateType === "coding" || data.templateType === "coding") {
        navigate(`/interview/session/${data.sessionId}/coding`);
      } else {
        navigate(`/interview/session/${data.sessionId}`);
      }
    } catch (startError) {
      logApiFailure("Start interview", "/api/interview/session/start", startError);
      setError(getApiErrorMessage(startError, startError.message || "Failed to start interview"));
    } finally {
      setLoadingAction("");
    }
  };

  const handleContinueInterview = async (sessionId) => {
    try {
      setError("");
      setResumeAction("resume");
      await axiosClient.post(`/api/interview/session/${sessionId}/resume`);
      navigate(`/interview/session/${sessionId}`);
    } catch (resumeError) {
      setError(resumeError.response?.data?.error || "Failed to resume interview");
    } finally {
      setResumeAction("");
    }
  };

  const handleDiscardInterview = async (sessionId) => {
    try {
      setError("");
      setResumeAction("discard");
      await axiosClient.post(`/api/interview/session/${sessionId}/discard`);
      setActiveSession(null);
    } catch (discardError) {
      setError(discardError.response?.data?.error || "Failed to discard interview");
    } finally {
      setResumeAction("");
    }
  };

  return (
    <div className="interview-workspace min-h-screen font-body relative pb-16">
      {/* Background patterns */}
      <div className="absolute inset-0 grid-pattern-overlay opacity-20 pointer-events-none z-0" />

      {/* Header bar */}
      <nav className="relative z-40 border-b border-white/8 bg-slate-900/60 backdrop-blur-xl px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-3">
          <NavLink to="/dashboard" className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:bg-white/10 transition-colors">
            <ArrowLeft size={16} />
          </NavLink>
          <div>
            <h1 className="text-lg font-black text-white font-heading tracking-tight leading-none">Start Mock Interview</h1>
            <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Configure templates, JD targets, and documents</p>
          </div>
        </div>
      </nav>

      {/* Onboarding grid */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Error Callout */}
        {error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/5 p-4 text-xs font-semibold text-red-400 flex items-center justify-between gap-3 animate-fade-up">
            <span>{error}</span>
            <button 
              onClick={() => setError("")} 
              className="px-2 py-1 rounded bg-white/5 border border-white/5 text-xs text-slate-300 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Restore existing active mocks */}
        {!activeSessionLoading && activeSession && (
          <div className="animate-fade-up">
            <ResumeInterviewCard
              session={activeSession}
              loadingAction={resumeAction}
              onContinue={handleContinueInterview}
              onDiscard={handleDiscardInterview}
            />
          </div>
        )}

        {/* Template Selectors: grid-cols-2 md:grid-cols-5 */}
        <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
          <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40">
            <h2 className="text-sm font-black text-white font-heading tracking-tight">Interview Template</h2>
            <p className="text-xs text-slate-400 mt-1">Select focus filters to adapt live interview questions dynamically</p>
          </div>

          <div className="p-5 grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-950/20">
            {templates.map((template) => {
              const Icon = template.icon;
              const selected = templateType === template.value;
              return (
                <button
                  key={template.value}
                  onClick={() => {
                    setTemplateType(template.value);
                    setInterviewType(template.value);
                  }}
                  className={`text-left rounded-xl border p-4 transition-all duration-300 flex flex-col justify-between min-h-[148px] select-none ${
                    selected 
                      ? "border-emerald-400 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.1)]" 
                      : "border-white/5 bg-slate-950 hover:bg-slate-900 hover:border-white/10"
                  }`}
                >
                  <Icon size={18} className={selected ? "text-emerald-400" : "text-slate-500"} />
                  <div className="mt-3 text-xs font-black text-white uppercase tracking-wider font-heading leading-tight">{template.label}</div>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-400 font-semibold">{template.focus}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Onboarding steps panel */}
        <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl">
          <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-white font-heading tracking-tight">Interview Setup Flow</h2>
              <p className="text-xs text-slate-400 mt-1">Complete chronological checklist before booting compilers</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <select
                  value={interviewType}
                  onChange={(event) => {
                    const val = event.target.value;
                    setInterviewType(val);
                    if (val !== "mock") {
                      setTemplateType(val);
                    }
                  }}
                  className="premium-input text-xs font-bold bg-[#0f172a] border border-white/10 rounded-lg py-2 pl-3 pr-8 focus:border-emerald-400 outline-none appearance-none cursor-pointer text-slate-200"
                  aria-label="Interview mock template type select"
                >
                  <option value="mock">General Practice Mock</option>
                  <option value="technical">Technical Assessment</option>
                  <option value="hr">Behavioral & Culture Fit</option>
                  <option value="genai">AI / ML Engineering</option>
                  <option value="coding">Live Coding Assessment</option>
                  <option value="full-mock">Comprehensive Interview</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
              
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={advancedMode}
                  onChange={(event) => setAdvancedMode(event.target.checked)}
                  className="checkbox checkbox-xs checkbox-emerald rounded border-white/20"
                />
                <span>Advanced JSON editor</span>
              </label>
            </div>
          </div>

          {/* Horizontal scrollable step badges on mobile, static cols on desktop */}
          <div className="p-5 flex overflow-x-auto gap-3 pb-4 md:grid md:grid-cols-4 premium-scrollbar bg-slate-950/20 select-none">
            <StepBadge number="1" title="Resume PDF" complete={Boolean(resumeData)} active={currentStep === 1} />
            <StepBadge number="2" title="JD Target" complete={Boolean(jdData)} active={currentStep === 2} />
            <StepBadge number="3" title="Analyze Match" complete={Boolean(analysisData)} active={currentStep === 3} />
            <StepBadge number="4" title="Start Match" complete={false} active={currentStep === 4} />
          </div>
        </section>

        {!advancedMode && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up">
              <UploadPanel
                title="Step 1: Upload Resume PDF"
                description="Upload, extract, and parse candidate skills, experience levels, and projects."
                file={resumeFile}
                parsedData={resumeData}
                loading={loadingAction === "resume"}
                fieldId="resume-upload"
                onFileChange={handleResumeFileChange}
                onUpload={handleResumeUpload}
              />
              <UploadPanel
                title="Step 2: Upload Job Description PDF"
                description="Upload target JD to parse required tech stacks, skills, and roles."
                file={jdFile}
                parsedData={jdData}
                loading={loadingAction === "jd"}
                fieldId="jd-upload"
                onFileChange={handleJdFileChange}
                onUpload={handleJdUpload}
              />
            </div>

            {/* Analyze trigger action container */}
            <section className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
              <div>
                <h2 className="text-sm font-black text-white font-heading tracking-tight">Step 3: Match Matrix Analysis</h2>
                <p className="text-xs text-slate-400 mt-1">Cross compare candidate profiles and parsed job requirements</p>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!resumeData || !jdData || loadingAction === "analysis"}
                className="premium-button text-xs font-black uppercase tracking-wider py-2.5 px-5 shadow-[0_0_15px_rgba(52,211,153,0.1)] flex items-center gap-1.5 shrink-0"
              >
                {loadingAction === "analysis" ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Generate Analysis</span>
                  </>
                )}
              </button>
            </section>

            {/* Counter sweep animations */}
            <AnalysisReview analysisData={analysisData} />
          </>
        )}

        {advancedMode && (
          <section className="premium-card overflow-hidden bg-slate-900/60 border border-white/8 shadow-xl animate-fade-up flex flex-col">
            <div className="px-5 py-4 border-b border-white/8 bg-slate-900/40 shrink-0">
              <h2 className="text-sm font-black text-white font-heading tracking-tight">Advanced JSON snapshot editor</h2>
              <p className="text-xs text-slate-400 mt-1">Verify or edit parsed snapshot snapshots before starting candidate rounds</p>
            </div>
            
            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-950/20 flex-1">
              {[
                ["Resume Snapshot JSON", advancedResumeData, setAdvancedResumeData],
                ["JD Snapshot JSON", advancedJdData, setAdvancedJdData],
                ["Analysis Matrix JSON", advancedAnalysisData, setAdvancedAnalysisData]
              ].map(([label, value, setter]) => (
                <label key={label} className="block space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                  <textarea
                    value={value}
                    onChange={(event) => setter(event.target.value)}
                    rows={15}
                    className="w-full premium-input bg-slate-950/50 p-3 text-[11px] font-mono leading-relaxed outline-none resize-y focus:border-emerald-400 text-slate-300"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Start Mock Session button */}
        <section className="premium-card p-5 bg-slate-900/60 border border-white/8 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 animate-fade-up">
          <div>
            <h2 className="text-sm font-black text-white font-heading tracking-tight">Step 4: Launch Mock Session</h2>
            <p className="text-xs text-slate-400 mt-1">Boot mock compilers and save parsed snapshots in live candidate transcripts</p>
          </div>
          
          <button
            onClick={handleStart}
            disabled={loadingAction === "start" || (!advancedMode && (!resumeData || !jdData || !analysisData))}
            className="premium-button text-sm uppercase tracking-wider font-black py-3.5 px-8 w-full sm:w-auto shadow-[0_0_20px_rgba(52,211,153,0.15)] flex items-center justify-center gap-2 group shrink-0"
          >
            {loadingAction === "start" ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Launching round...</span>
              </>
            ) : (
              <>
                <Rocket size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                <span>Start Mock Session</span>
              </>
            )}
          </button>
        </section>
      </main>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default InterviewStart;
